# Changelog

このプロジェクトの主要な変更は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に従って記載しています。

## [v2.5.1+MZ] - 2026-08-11

- feat: COMMON_KEY 未設定のまま本番起動した場合に警告を出す
- fix: 公開サーバー運用に向けて入力検証とクラッシュ耐性を強化
- chore: 依存関係の脆弱性を解消し helmet / express-rate-limit を追加

## [v2.5.0+MZ] - 2026-08-10

- feat: 新グループ「ステージ9」(総合演習)を追加
- feat: ステージ6-2を追加
- feat: ステージ5-4・5-5を追加
- feat: ステージ4-5・4-6を追加
- feat: ステージ3-5・3-6を追加
- feat: チュートリアル用CPUにレベル3(隣接アイテム取得+ランダム移動)を実装

## [v2.4.1+MZ] - 2026-08-10

- fix: チュートリアルの実行ボタンがリセットボタンに切り替わらない不具合を修正
- fix: CPU側のアイテム取得によるスコア誤加算バグを修正
- fix: チュートリアルのローカルゲームエンジンでhart_score/my_turn/endCode()が2重宣言されていたバグを修正

## [v2.4.0+MZ] - 2026-07-06

- fix: 実行ボタンのタッチ/クリックイベントがコードとして誤実行される不具合を修正
- refactor: encode.js/encode_match.jsのObjInterpreterとAPI配線をencode_core.jsに統合
- refactor: winer(誤字)をwinnerにリネーム
- refactor: classifyCell/scanCellsをchaser/board_scan.jsへ分離
- refactor: move_player/look/search/put_wallの周辺セル分類をclassifyCell/scanCellsに共通化
- refactor: chara_num/chara_num_diffをモジュール定数に集約
- refactor: programming.ejs/programming-exp.ejsをvariantで統合
- refactor: scroll-x.jsとmenu-programming系ビュー・ルートをvariantで統合
- refactor: programming.jsのi18n読み込みをtool/language_load.jsに統一
- refactor: programming.jsとprogramming-exp.jsの重複コードを共通ファクトリ関数に統合
- refactor: Socket.ioイベント名をsocket_events.jsに定数化し、サーバー・クライアント間の綴りズレを防止
- refactor: JSONディレクトリ読み込み・ディープクローン処理を共通化し、match.jsの未使用コードを削除
- refactor: 6ルートファイルに重複していたi18n読み込み処理をtool/language_load.jsに共通化
- docs: リファクタリング時のElectron手動確認チェックリストを追加
- refactor: server.js分割の未使用草稿とusers.js雛形を削除
- docs: ScreenShot.pngをdocs/へ移動しREADMEの参照パスを修正
- chore: http-errorsのバージョンを^2.0.0に統一
- test: node --testによる最小テスト基盤を追加
- docs: READMEのリンク切れ・陳腐化した記述の修正とlanguage/へのREADME追加

## [v2.3.1+MZ] - 2026-07-06

- fix: 対戦結果画面の「もう一度」でCPU対戦のmy_charaが引き継がれない不具合を修正

## [v2.3.0+MZ] - 2026-06-26

- refactor: バージョン情報をpackage.jsonに一元化
- feat: CPU対戦キャラクター選択の内部ロジックを実装
- feat: CPU対戦にキャラクター選択UIを追加
- feat: ユーザーアップロードマップで対戦できる機能を追加
- fix: 対戦終了後にmatch_room_storeが残りルームが再利用不可になるバグを修正
- feat: 対戦メニューにオリジナルルームのUIを追加
- feat: server_join ブロックをマップ選択 + モード選択形式に変更
- feat: マップエディタ(/map-editor)を実装
- refactor: watching_info パネルをデザインシステムに統一
- refactor: 対戦メニューを1マップ1カードに変更し右パネルでVS/CPU対戦を選択
- refactor: CUP/VS マップデータを統合し auto_xxx / vs_xxx の命名規則に変更
- chore: add Claude Code config (private .claude/ via .gitignore)

## [v2.2.0+MZ] - 2026-06-20

- docs: ライセンスと利用規約を更新
- Update: プログラムブロックのカテゴリー名を CHaser に変更
- feat: パステルカラーにデザインを変更
- feat: チュートリアルメニューカードをダブルクリックでステージ選択

## [v2.1.3+MZ] - 2026-05-31

- fix: Blockly の縮小表示時のドラッグ座標ずれを修正

## [v2.1.2+MZ] - 2026-05-30

- fix: python版プログラムの CHaser.py を pyCHaser.py に修正
- fix: math_numberが入力できない現象への対応

## [v2.1.0+MZ] - 2026-05-29

- feat: アプリ版用に規定サイズを変更
- feat: プログラムエリアで縮小表示に対応
- feat: チュートリアルメニューで縮小表示に対応
- feat: 対戦メニューで縮小表示に対応

## [v2.0.1+MZ] - 2026-05-28

- fix: メインメニューのスタイルシートを修正

## [v2.0.0+MZ] - 2026-04-16

v4.5.0 からバージョン体系を `2.x+MZ`(舞鶴版)に切り替え。

- feat: 交流大会マップを追加
- feat: 一関版マップを削除
- docs: 舞鶴版ReadMeに修正
