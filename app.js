var createError = require('http-errors');
var express = require('express');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
const logger = require('./bin/logger.js');

var indexRouter = require('./routes/index');

var menuProgrammingRouter = require('./routes/menu-programming');
var programmingRouter = require('./routes/programming');
var menuProgrammingexpRouter = require('./routes/menu-programming-exp');
var programmingexpRouter = require('./routes/programming-exp');
var menuTutorialRouter = require('./routes/menu-tutorial');
var tutorialRouter = require('./routes/tutorial');
var menuMatchRouter = require('./routes/menu-match');
var matchRouter = require('./routes/match');
var watchingRouter = require('./routes/watching');
var mapEditorRouter = require('./routes/map-editor');

var server_data = require('./tool/server_data_load');
var tutorial_data = require('./tool/tutorial_data_load');
var bgm_data = require('./tool/bgm_data_load');
var config_load = require('./tool/config_data_load');
var deep_clone = require('./tool/deep_clone');
var validate_room = require('./tool/validate_room');

var chaser = require('./chaser/server.js');

var app = express();


//socket.io
app.io = chaser.io;


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.locals.appVersion = require('./package.json').version;

// render.com は TLS を終端してリバースプロキシ経由で転送するため、
// X-Forwarded-* を信頼しないとレート制限が全リクエストを同一クライアントと見なしてしまう
app.set('trust proxy', 1);

// セキュリティヘッダを付与する。
// Blockly と gtag がインラインスクリプトを使うため CSP は現時点では無効にしている
// (CSP の導入はインラインスクリプトの整理が必要なため別途対応)
app.use(helmet({ contentSecurityPolicy: false }));

app.use(morgan('dev'));
// リクエストボディの上限を明示する (既定の 100kb 依存を避ける)
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var mode_path = config_load.electron_conf_load();

app.use('/bgm',express.static(path.join(__dirname, mode_path, 'load_data', 'bgm_data')));
app.use('/about/LICENSE',express.static(path.join(__dirname, mode_path, 'LICENSE')));
app.use('/about/TOS',express.static(path.join(__dirname, mode_path, '/TOS')));

app.use('/', indexRouter);
app.use('/menu-programming', menuProgrammingRouter);
app.use('/programming', programmingRouter);
app.use('/menu-programming-exp', menuProgrammingexpRouter);
app.use('/programming-exp', programmingexpRouter);
app.use('/menu-tutorial', menuTutorialRouter);
app.use('/tutorial', tutorialRouter);
app.use('/menu-match',menuMatchRouter);
app.use('/match', matchRouter);
app.use('/watching',watchingRouter);
app.use('/map-editor', mapEditorRouter);



//API

//init load
const bgm_list = bgm_data.load();

let game_server = deep_clone.deepClone(server_data.load());

let join_list = server_data.list_load().filter(item => !item[0].includes('room_onetime'));
const stage_data = deep_clone.deepClone(tutorial_data.load());


const reloadServerData = async () => {
  game_server = deep_clone.deepClone(server_data.load());
  join_list = server_data.list_load().filter(item => !item[0].includes('room_onetime'));
};


app.get('/api/bgm', (req, res) => {
  res.json(bgm_list);
});

// 合言葉つきルームは "<ルームID>?<合言葉>" をキーにして保持されるため、
// 一覧をそのまま返すと合言葉が第三者に読み取れてしまう。
// これまでブラウザ側だけで行っていた除外をサーバー側でも行う
const isPrivateRoomKey = (key) => key.includes('?');

app.get('/api/game', async(req, res) => {
  await reloadServerData();
  if(req.query.room_id){
    if(typeof req.query.room_id === 'string' && game_server[req.query.room_id]){
      res.json(game_server[req.query.room_id]);
    }
    else{
      res.json(false);
    }
  }
  else{
    const public_rooms = {};
    for(const room_id in game_server){
      if(!isPrivateRoomKey(room_id)){
        public_rooms[room_id] = game_server[room_id];
      }
    }
    res.json(public_rooms);
  }
});

app.get('/api/tutorial', (req, res) => {
  res.json(stage_data);
});

app.get('/api/join', async(req, res) => {
  await reloadServerData();
  res.json(join_list);
});

// ルームコードを生成する。予測しにくい乱数を使い、既存ルームとの衝突も避ける
const generateRoomCode = () => {
  for (let i = 0; i < 10; i++) {
    const shortCode = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    if (!game_server['upload_' + shortCode]) {
      return shortCode;
    }
  }
  return null;
};

// アップロードは無認証で誰でも実行できるため、投稿頻度を制限する
const uploadMapLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['アップロードの回数が多すぎます。しばらく待ってから再度お試しください'] }
});

app.post('/api/upload-map', uploadMapLimiter, async (req, res, next) => {
  try {
    const result = validate_room.validateRoom(req.body);
    if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

    await reloadServerData();
    const shortCode = generateRoomCode();
    if (!shortCode) {
      return res.status(503).json({ ok: false, errors: ['ルームを作成できませんでした。しばらく待ってから再度お試しください'] });
    }

    const room_id = 'upload_' + shortCode;
    const roomData = Object.assign({}, result.value, {
      room_id,
      cool: { status: false, turn: false },
      hot:  { status: false, turn: false },
      cpu:  { turn: "hot", level: 3 }
    });

    const created = await server_data.create_new_map(roomData);
    if (!created) {
      return res.status(503).json({ ok: false, errors: ['ルームの上限に達しています。しばらく待ってから再度お試しください'] });
    }
    await chaser.reloadRoom(room_id);
    res.json({ ok: true, room_id, shortCode });
  }
  catch (e) {
    next(e);
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
