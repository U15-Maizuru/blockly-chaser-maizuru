var createError = require('http-errors');
var express = require('express');
var fs = require('fs');
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
const logger = require('./bin/logger.js');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

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

var chaser = require('./chaser/server.js');

var app = express();


//socket.io
app.io = chaser.io;


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.locals.appVersion = require('./package.json').version;

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var mode_path = config_load.electron_conf_load();

app.use('/bgm',express.static(path.join(__dirname, mode_path, 'load_data', 'bgm_data')));
app.use('/about/LICENSE',express.static(path.join(__dirname, mode_path, 'LICENSE')));
app.use('/about/TOS',express.static(path.join(__dirname, mode_path, '/TOS')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
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

let game_server = JSON.parse(JSON.stringify(server_data.load()));

let join_list = server_data.list_load().filter(item => !item[0].includes('room_onetime'));
const stage_data = JSON.parse(JSON.stringify(tutorial_data.load()));


const reloadServerData = async () => {
  game_server = JSON.parse(JSON.stringify(server_data.load()));
  join_list = server_data.list_load().filter(item => !item[0].includes('room_onetime'));  
};


app.get('/api/bgm', (req, res) => {
  res.json(bgm_list);
});

app.get('/api/game', async(req, res) => {
  await reloadServerData();
  if(req.query.room_id){
    if(game_server[req.query.room_id]){
      res.json(game_server[req.query.room_id]);
    }
    else{
      res.json(false);
    }
  }
  else{
    res.json(game_server);
  }
});

app.get('/api/tutorial', (req, res) => {
  res.json(stage_data);
});

app.get('/api/join', async(req, res) => {
  await reloadServerData();
  res.json(join_list);
});

app.post('/api/upload-map', async (req, res) => {
  const d = req.body;
  const errors = [];
  if (!d.name)                                                      errors.push('name が必要です');
  if (!d.map_size_x || d.map_size_x < 5 || d.map_size_x > 30)     errors.push('map_size_x は 5〜30');
  if (!d.map_size_y || d.map_size_y < 5 || d.map_size_y > 30)     errors.push('map_size_y は 5〜30');
  if (!d.turn       || d.turn < 1       || d.turn > 500)           errors.push('turn は 1〜500');
  if (d.map_data && d.map_data.length > 0) {
    if (d.map_data.length !== d.map_size_y || d.map_data[0].length !== d.map_size_x)
      errors.push('map_data の寸法が map_size と一致しない');
  }
  if (errors.length) return res.json({ ok: false, errors });

  const shortCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  const room_id   = 'upload_' + shortCode;
  const roomData = {
    name:          d.name,
    room_id,
    map_size_x:    d.map_size_x,
    map_size_y:    d.map_size_y,
    map_data:      d.map_data      || [],
    auto_block:    d.auto_block    || 20,
    auto_point:    d.auto_point    || 30,
    auto_symmetry: d.auto_symmetry || false,
    cool:          { status: false, turn: false },
    hot:           { status: false, turn: false },
    cpu:           { turn: "hot", level: 3 },
    turn:          d.turn,
  };
  await server_data.create_new_map(roomData);
  await chaser.reloadRoom(room_id);
  res.json({ ok: true, room_id, shortCode });
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
