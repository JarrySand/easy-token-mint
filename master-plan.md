# Easy Token Mint - マスター開発プラン

**バージョン:** 1.0
**作成日:** 2026年1月13日
**仕様書参照:** [spec.md](spec.md)

---

## Phase 1: MVP（基盤構築）

### 1.1 プロジェクトセットアップ

- [x] Electronプロジェクトの初期化
  - 参照: [spec.md#2.2 技術スタック](spec.md#L66-L77)
  - Electron + React + TypeScript構成
  - Tailwind CSS / Shadcn/ui導入

- [x] ビルド環境の構築
  - 参照: [spec.md#10.1 ビルド成果物](spec.md#L1340-L1346)
  - electron-builder設定
  - Windows/macOS/Linux向けビルド設定

- [x] Electronセキュリティ設定
  - 参照: [spec.md#7.3.1-② Electronセキュリティ設定](spec.md#L960-L989)
  - nodeIntegration: false
  - contextIsolation: true
  - sandbox: true
  - CSPヘッダー設定

### 1.2 データストレージ基盤

- [x] OS別データディレクトリの実装
  - 参照: [spec.md#5.1 ローカルストレージ構成](spec.md#L740-L783)
  - Windows: `%APPDATA%\easy-token-mint\`
  - macOS: `~/Library/Application Support/easy-token-mint/`
  - Linux: `~/.config/easy-token-mint/`

- [x] SQLiteデータベースのセットアップ
  - 参照: [spec.md#5.3 SQLiteスキーマ](spec.md#L801-L838)
  - tokensテーブル作成
  - operation_logsテーブル作成
  - インデックス作成

- [x] OS別ファイル権限の設定
  - 参照: [spec.md#5.1 OS別ファイル権限](spec.md#L764-L783)
  - macOS/Linux: chmod 600/700
  - Windows: ACL設定

- [x] SQLite自動バックアップ機能
  - 参照: [spec.md#7.3.1-⑥ SQLiteバックアップ機能](spec.md#L1041-L1054)
  - 起動時に自動バックアップ
  - 直近3世代保持

- [x] config.json管理
  - 参照: [spec.md#5.2 config.json](spec.md#L604-L616)
  - version, network, language, alertThresholds, walletAddress

### 1.3 秘密鍵管理

- [x] 秘密鍵暗号化モジュールの実装
  - 参照: [spec.md#5.4 秘密鍵暗号化仕様](spec.md#L840-L860)
  - AES-256-GCM暗号化
  - PBKDF2-SHA256鍵導出（600,000イテレーション）
  - wallet.enc構造の実装

- [x] 秘密鍵インポート機能
  - 参照: [spec.md#SCR-002 初期設定画面](spec.md#L317-L334)
  - テキスト入力（64文字hex）
  - ~~JSONファイル読み込み~~ (Phase 2へ移動)
  - アドレスプレビュー表示

- [x] メモリ保護の実装
  - 参照: [spec.md#6.1 秘密鍵の保護](spec.md#L865-L873)
  - 使用後即座にゼロクリア

### 1.4 PIN認証システム

- [x] PIN設定画面の実装
  - 参照: [spec.md#SCR-002 ステップ2: PIN設定](spec.md#L326-L329)
  - 8文字以上、英数字混在必須
  - 強度インジケーター（連続文字・辞書単語の警告）
  - 確認入力

- [x] PIN入力画面の実装
  - 参照: [spec.md#SCR-001 PIN入力画面](spec.md#L301-L314)
  - マスク表示
  - ~~言語切替（日本語/英語）~~ (Phase 3へ移動)
  - アプリロゴ表示

- [x] PIN認証ロジック
  - 参照: [spec.md#6.2 PIN認証](spec.md#L874-L882)
  - 3回連続失敗で5分間ロック
  - 連続ロック時は待機時間を倍増（上限30分）
  - カウントダウン表示

### 1.5 初期設定フロー

- [x] 初期設定画面（SCR-002）
  - 参照: [spec.md#SCR-002 初期設定画面](spec.md#L317-L334)
  - ステップ1: 秘密鍵インポート
  - ステップ2: PIN設定
  - ステップ3: ネットワーク選択（Mainnet/Testnet）
  - 確認画面

### 1.6 ブロックチェーン接続基盤

- [x] ethers.js v6のセットアップ
  - 参照: [spec.md#2.2 技術スタック](spec.md#L72-L73)

- [x] RPCプロバイダー設定
  - 参照: [spec.md#2.4 ネットワーク](spec.md#L85-L90)
  - Polygon Mainnet (Chain ID: 137)
  - Polygon Amoy Testnet (Chain ID: 80002)

- [x] RPCフォールバック機能
  - 参照: [spec.md#7.3.1-⑤ RPCフォールバック設定](spec.md#L1011-L1039)
  - 複数エンドポイントの自動切り替え

### 1.7 基本UI（日本語のみ）

- [x] 画面遷移の実装
  - 参照: [spec.md#4.2 画面遷移図](spec.md#L272-L297)
  - 起動→PIN入力→ダッシュボード
  - 初回起動時は初期設定画面へ

- [x] ダッシュボード画面
  - 参照: [spec.md#SCR-003 ダッシュボード](spec.md#L337-L364)
  - ウォレットアドレス表示
  - MATIC残高表示
  - 管理トークン一覧
  - ネットワーク表示

- [x] 単発ミント画面
  - 参照: [spec.md#SCR-004 トークン発行画面 - 単発発行](spec.md#L375-L391)
  - トークン選択
  - 発行先アドレス入力（バリデーション付き）
  - 発行量入力
  - ガス見積表示

- [x] アプリケーションログ
  - 参照: [spec.md#5.1 ディレクトリ構造](spec.md#L568-L580)
  - logs/app.log への出力
  - 設定画面から「ログフォルダを開く」機能

### 1.8 スマートコントラクト

- [x] MintableTokenコントラクトの実装
  - 参照: [spec.md#3.1 ベースコントラクト](spec.md#L96-L148)
  - ERC20 + ERC20Capped + AccessControl
  - decimalsパラメータ対応
  - MINTER_ROLE実装

- [x] 単発ミント機能の実装
  - 参照: [spec.md#3.4 権限管理](spec.md#L248-L253)
  - mint関数呼び出し
  - トランザクション送信・確認

### 1.9 トランザクション確認

- [x] トランザクション確認ダイアログ
  - 参照: [spec.md#6.3 トランザクション確認](spec.md#L884-L888)
  - 発行前に必ず確認ダイアログを表示
  - ~~高額発行時の追加警告（設定可能な閾値）~~ (Phase 3へ移動)

---

## Phase 2: 機能拡充

### 2.1 CSV一括発行

- [x] BatchMinterコントラクトの実装
  - 参照: [spec.md#3.2 バッチミントコントラクト](spec.md#L150-L235)
  - 最大100件/バッチ
  - 部分失敗対応
  - イベント発行

- [x] CSVパース・バリデーション
  - 参照: [spec.md#CSV一括発行の処理フロー](spec.md#L428-L467)
  - アドレス形式検証
  - 数量検証
  - 無効行マーク表示

- [x] バッチ分割ロジック
  - 参照: [spec.md#CSV一括発行の処理フロー - バッチ分割](spec.md#L435-L437)
  - 100件単位で分割

- [x] CSV一括発行UI
  - 参照: [spec.md#SCR-004 CSV一括発行](spec.md#L393-L419)
  - ファイル選択
  - プレビュー表示
  - 「無効なアドレスをスキップ」オプション

- [x] 一括発行結果画面
  - 参照: [spec.md#CSV一括発行の処理フロー - 結果表示](spec.md#L447-L463)
  - バッチごとの進捗表示
  - 失敗分のCSVエクスポート

### 2.2 複数トークン管理

- [x] トークン管理画面
  - 参照: [spec.md#SCR-005 トークン管理画面](spec.md#L471-L516)
  - 登録済みトークン一覧
  - 権限表示

- [x] 新規トークンデプロイ機能
  - 参照: [spec.md#SCR-005 新規デプロイダイアログ](spec.md#L494-L516)
  - 参照: [spec.md#3.3 デプロイ時設定項目](spec.md#L235-L246)
  - トークン名・シンボル入力
  - 小数点桁数設定（デフォルト18）
  - 発行上限設定（無制限/上限あり）
  - 初期発行設定（発行量・発行先）
  - デプロイ費用見積表示

- [x] 既存トークン追加機能
  - 参照: [spec.md#SCR-005 既存トークン追加ダイアログ](spec.md#L518-L561)
  - コントラクトアドレス入力
  - ERC20準拠チェック
  - AccessControl対応チェック
  - MINTER_ROLE定義チェック
  - 権限確認表示

### 2.3 権限管理

- [x] 権限管理画面
  - 参照: [spec.md#SCR-006 権限管理画面](spec.md#L563-L587)
  - 現在のミンター一覧
  - 自分の権限表示

- [x] ミンター追加機能
  - 参照: [spec.md#3.4 権限管理](spec.md#L248-L253)
  - grantRole(MINTER_ROLE, address)

- [x] ミンター削除機能
  - 参照: [spec.md#3.4 権限管理](spec.md#L248-L253)
  - revokeRole(MINTER_ROLE, address)

### 2.4 操作ログ・CSVエクスポート

- [x] 履歴画面
  - 参照: [spec.md#SCR-007 履歴画面](spec.md#L591-L614)
  - 操作種別フィルター
  - トークンフィルター
  - 期間フィルター

- [x] 操作ログ記録
  - 参照: [spec.md#5.3 SQLiteスキーマ - operation_logs](spec.md#L817-L832)
  - deploy, mint, grant_role, revoke_role
  - TX Hash記録
  - ステータス管理

- [x] CSVエクスポート機能
  - 参照: [spec.md#SCR-007 CSVエクスポート形式](spec.md#L610-L614)
  - timestamp, operation, token_symbol, token_address, details, tx_hash, operator_address

---

## Phase 3: 完成

### 3.1 英語対応

- [x] i18n基盤構築
  - 参照: [spec.md#8.2 実装方式](spec.md#L1223-L1226)
  - i18next / react-i18next導入
  - 言語ファイル分離

- [x] 日本語翻訳ファイル
  - 参照: [spec.md#8.3 翻訳キー例](spec.md#L1228-L1239)

- [x] 英語翻訳ファイル
  - 参照: [spec.md#8.1 対応言語](spec.md#L1218-L1221)

- [x] 言語切替UI
  - 参照: [spec.md#SCR-008 設定画面](spec.md#L627-L631)

### 3.2 Amoyテストネット対応

- [x] ネットワーク切替機能
  - 参照: [spec.md#SCR-008 ネットワーク切替時の動作](spec.md#L650-L657)
  - トークン一覧フィルタリング
  - 操作ログフィルタリング
  - MATIC残高取得

- [x] 切替確認ダイアログ
  - 参照: [spec.md#SCR-008 切替確認ダイアログ](spec.md#L659-L672)

- [x] ネットワーク別BatchMinter管理
  - 参照: [spec.md#SCR-008 ネットワーク切替時の動作](spec.md#L657)

### 3.3 残高アラート

- [x] MATIC残高監視
  - 参照: [spec.md#SCR-003 アラート条件](spec.md#L361-L363)
  - < 1.0 MATIC: 警告（黄色）
  - < 0.1 MATIC: 危険（赤色）

- [x] アラート閾値設定
  - 参照: [spec.md#SCR-008 残高アラート閾値](spec.md#L636-L641)
  - 警告閾値の変更
  - 危険閾値の変更

### 3.4 設定画面

- [x] PIN変更機能
  - 参照: [spec.md#SCR-008 PIN変更フロー](spec.md#L673-L695)
  - 現在のPIN認証
  - 新PIN入力・確認
  - 秘密鍵の再暗号化

- [x] 秘密鍵再インポート機能
  - 参照: [spec.md#SCR-008 秘密鍵の再インポートフロー](spec.md#L697-L733)
  - 既存データ保持
  - 新アドレスへの更新

### 3.5 トランザクション状態管理

- [x] TX状態UI
  - 参照: [spec.md#9.3 トランザクション状態とUI表示](spec.md#L1266-L1334)
  - pending/confirming/success/failed/timeout状態
  - ステップ表示
  - TX Hash表示
  - Polygonscanリンク

- [x] タイムアウト処理
  - 参照: [spec.md#9.3 タイムアウト時の対応](spec.md#L1306-L1328)
  - 5分タイムアウト
  - 待機続行オプション

- [x] 未確認TX復旧
  - 参照: [spec.md#9.3 アプリ再起動時の未確認TX処理](spec.md#L1330-L1334)
  - 起動時にpending TX確認
  - 結果通知

### 3.6 エラーハンドリング

- [x] エラー分類実装
  - 参照: [spec.md#9.1 エラー分類](spec.md#L1244-L1253)
  - ネットワーク: リトライ + 代替RPC
  - 残高不足: アラート + 処理中断
  - 権限エラー: メッセージ表示
  - 入力エラー: バリデーション表示
  - TX失敗: 詳細ログ + リトライ案内

- [x] エラーメッセージ多言語対応
  - 参照: [spec.md#9.2 エラーメッセージ例](spec.md#L1255-L1264)

### 3.7 セキュリティ機能

- [x] クリップボード自動クリア
  - 参照: [spec.md#7.3.1-④ クリップボード自動クリア](spec.md#L999-L1009)
  - コピー後30秒で自動クリア

- [x] 依存パッケージ監査設定
  - 参照: [spec.md#7.3.1-⑦ 依存パッケージ監査](spec.md#L1056-L1067)
  - npm audit スクリプト
  - preinstall時のcritical脆弱性チェック

- [x] 技術的リスク対策の実装確認
  - 参照: [spec.md#7.1 リスク一覧](spec.md#L894-L936)
  - 参照: [spec.md#7.2 リスク評価マトリクス](spec.md#L937-L946)
  - ローカル環境攻撃対策（メモリ保護、PIN強化）
  - Electron脆弱性対策（セキュリティ設定）
  - スマートコントラクトリスク対策（Admin冗長化）
  - ネットワークリスク対策（RPCフォールバック）
  - 運用リスク対策（DBバックアップ）

### 3.8 ビルド・配布

- [x] Windowsビルド
  - 参照: [spec.md#10.1 ビルド成果物](spec.md#L1343)
  - .exe (NSIS installer)
  - コード署名（推奨）

- [x] macOSビルド
  - 参照: [spec.md#10.1 ビルド成果物](spec.md#L1344)
  - .dmg
  - Apple Developer ID署名（推奨）

- [x] Linuxビルド
  - 参照: [spec.md#10.1 ビルド成果物](spec.md#L1346)
  - .AppImage, .deb
  - GPG署名（推奨）

- [x] 自動更新機能
  - 参照: [spec.md#10.2 自動更新](spec.md#L1348-L1351)
  - electron-updater設定
  - GitHub Releases連携

### 3.9 ドキュメント整備

- [x] セキュリティガイドライン
  - 参照: [spec.md#7.4 ユーザー向けセキュリティガイドライン](spec.md#L1096-L1124)
  - docs/security-guidelines.md

- [x] Admin権限冗長化ガイドライン
  - 参照: [spec.md#7.3.1-③ Admin権限の冗長化ガイドライン](spec.md#L991-L997)
  - docs/admin-redundancy-guidelines.md

- [x] インシデント対応手順
  - 参照: [spec.md#7.5 インシデント対応手順](spec.md#L1126-L1152)
  - docs/incident-response.md

- [x] 運用ガイドライン
  - 参照: [spec.md#7.6 運用ガイドライン](spec.md#L1154-L1212)
  - docs/operation-guidelines.md

- [x] 用語集・参考リンク
  - 参照: [spec.md#12.1 用語集](spec.md#L951-L958)
  - 参照: [spec.md#12.2 参考リンク](spec.md#L960-L965)
  - docs/glossary.md

---

## 完了条件チェックリスト

### Phase 1 完了条件
- [x] PIN認証でアプリにログインできる
- [x] 秘密鍵をインポート・暗号化保存できる
- [x] 単発でトークンをミントできる
- [x] 1つのトークンを管理できる
- [x] 日本語UIで操作できる

### Phase 2 完了条件
- [x] CSVファイルから一括発行できる
- [x] 複数のトークンを管理できる
- [x] 新規トークンをデプロイできる
- [x] ミンター権限を追加・削除できる
- [x] 操作ログをCSVエクスポートできる

### Phase 3 完了条件
- [x] 英語UIで操作できる
- [x] Mainnet/Testnetを切り替えできる
- [x] MATIC残高アラートが表示される
- [x] Windows/macOS/Linuxでビルドできる
- [x] ユーザードキュメントが整備されている

---

## 将来バージョンで検討（スコープ外）

以下は本バージョンでは実装しないが、将来検討する項目。

- [ ] ハードウェアウォレット対応
  - 参照: [spec.md#7.3.2-① ハードウェアウォレット対応](spec.md#L1071-L1081)
  - Ledger Nano S/X、Trezor対応

- [ ] マルチシグ対応
  - 参照: [spec.md#7.3.2-② マルチシグ対応](spec.md#L1083-L1087)
  - Gnosis Safe連携

- [ ] 監査ログのクラウドバックアップ
  - 参照: [spec.md#7.3.2-③ 監査ログのクラウドバックアップ](spec.md#L1089-L1094)
  - AWS S3/Google Cloud Storage

---

## 進捗サマリー

| Phase | 完了 | 未完了 | 進捗率 |
|-------|------|--------|--------|
| Phase 1 | 20 | 0 | 100% |
| Phase 2 | 15 | 0 | 100% |
| Phase 3 | 25 | 0 | 100% |
| **合計** | **60** | **0** | **100%** |

### Phase 1 残タスク
完了！

### Phase 2 残タスク
完了！

### Phase 3 残タスク
完了！

---

**プラン終わり**
