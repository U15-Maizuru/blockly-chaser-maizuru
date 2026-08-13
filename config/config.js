module.exports = {
    // アップロードされたルームデータに付与されたkeyとの一致を確認するための認証キー。
    // 公開サーバーでは環境変数 COMMON_KEY で必ず上書きすること
    // (ソースコードは公開リポジトリにあるため、既定値は秘密として扱えない)。
    // 既定値はローカル開発と Electron 版のためのフォールバック
    commonKey: process.env.COMMON_KEY || 'U15_Procon',
    deleteRoomTime: 60 ,//単位分 floatで処理しているので少数設定可能　例；10分30秒であれば10.5と記入
};