# Easy Token Mint - テスト作成計画書

**バージョン:** 1.0
**作成日:** 2026年1月13日
**対象プロジェクト:** Easy Token Mint
**参照:** [master-plan.md](../master-plan.md), [spec.md](../spec.md)

---

## 1. 概要

### 1.1 目的

本計画書は、Easy Token Mintアプリケーションの品質保証のための網羅的なテスト戦略を定義します。

### 1.2 テスト対象範囲

| カテゴリ | ファイル数 | 説明 |
|----------|-----------|------|
| Main Process（バックエンド） | 12 | 暗号化、認証、DB、ブロックチェーン連携 |
| Renderer（フロントエンド） | 25 | React コンポーネント、ページ、ダイアログ |
| Shared | 1 | 型定義（types.ts） |

### 1.3 テスト環境構築

#### 必要なパッケージ

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0"
  }
}
```

#### 設定ファイル

- `vitest.config.ts` - Vitest設定
- `vitest.setup.ts` - グローバルセットアップ
- `src/__mocks__/` - モックファイル

---

## 2. テストカテゴリと優先度

### 優先度定義

| 優先度 | 説明 | 基準 |
|--------|------|------|
| **P0（Critical）** | 最優先 | セキュリティ、データ整合性に直結 |
| **P1（High）** | 高優先 | コア機能、ユーザー操作に影響 |
| **P2（Medium）** | 中優先 | 補助機能、UX改善 |
| **P3（Low）** | 低優先 | ユーティリティ、UI部品 |

---

## 3. Main Process（バックエンド）テスト

### 3.1 crypto.ts - 暗号化モジュール 【P0】

**テストファイル:** `src/main/__tests__/crypto.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **暗号化/復号化** |||
| TC-CRYPTO-001 | 正常な暗号化・復号化サイクル | 秘密鍵が正しく暗号化・復号できる |
| TC-CRYPTO-002 | 不正なPINでの復号失敗 | 異なるPINでは復号できない |
| TC-CRYPTO-003 | 破損データの復号失敗 | 改ざんされたデータを検出する |
| TC-CRYPTO-004 | 空のデータ処理 | 空文字列の適切なエラー処理 |
| **PIN検証** |||
| TC-CRYPTO-005 | 有効なPIN形式（8文字以上、英数字混在） | 正規表現による検証 |
| TC-CRYPTO-006 | 無効なPIN（短すぎる） | 8文字未満は拒否 |
| TC-CRYPTO-007 | 無効なPIN（数字のみ） | 英字必須 |
| TC-CRYPTO-008 | 無効なPIN（英字のみ） | 数字必須 |
| **PIN強度計算** |||
| TC-CRYPTO-009 | 強いPINの強度スコア | 長さ・多様性でスコア算出 |
| TC-CRYPTO-010 | 弱いPINの強度スコア | 連続文字・辞書単語で減点 |
| **タイミング攻撃対策** |||
| TC-CRYPTO-011 | secureCompare()の一致判定 | 正しく一致を判定 |
| TC-CRYPTO-012 | secureCompare()の不一致判定 | 正しく不一致を判定 |

### 3.2 pin-auth.ts - PIN認証モジュール 【P0】

**テストファイル:** `src/main/__tests__/pin-auth.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **認証フロー** |||
| TC-AUTH-001 | 正しいPINでの認証成功 | 認証成功を返す |
| TC-AUTH-002 | 間違ったPINでの認証失敗 | 認証失敗を返す |
| TC-AUTH-003 | 認証成功後のカウンターリセット | 失敗カウントが0になる |
| **ロックアウト機能** |||
| TC-AUTH-004 | 3回失敗で5分ロック | ロック状態になる |
| TC-AUTH-005 | 連続ロックで時間倍増（10分） | 指数的増加 |
| TC-AUTH-006 | ロック時間上限（30分） | 上限を超えない |
| TC-AUTH-007 | ロック中の認証試行拒否 | ロック中はエラー |
| TC-AUTH-008 | ロック時間経過後の解除 | 時間経過で再認証可能 |
| **PIN変更** |||
| TC-AUTH-009 | 正常なPIN変更 | 古いPINで認証→新PINに変更 |
| TC-AUTH-010 | 現在のPINが間違い | PIN変更失敗 |
| TC-AUTH-011 | 新PINが形式不正 | PIN変更失敗 |

### 3.3 database.ts - データベースモジュール 【P0】

**テストファイル:** `src/main/__tests__/database.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **初期化** |||
| TC-DB-001 | データベース初期化 | テーブル・インデックス作成 |
| TC-DB-002 | WALモード設定 | SQLite WALモードが有効 |
| **トークンCRUD** |||
| TC-DB-003 | トークン挿入 | 新規トークンをDBに保存 |
| TC-DB-004 | トークン取得（全件） | 全トークンを取得 |
| TC-DB-005 | トークン取得（ネットワーク別） | mainnet/testnetでフィルタ |
| TC-DB-006 | トークン取得（アドレス指定） | アドレスで1件取得 |
| TC-DB-007 | トークン更新 | 既存トークンの情報更新 |
| TC-DB-008 | 重複アドレス登録の防止 | UNIQUE制約エラー |
| **操作ログCRUD** |||
| TC-DB-009 | 操作ログ挿入 | 新規ログをDBに保存 |
| TC-DB-010 | 操作ログ取得（全件） | 全ログを取得 |
| TC-DB-011 | 操作ログフィルタ（操作種別） | deploy/mint等でフィルタ |
| TC-DB-012 | 操作ログフィルタ（トークンID） | 特定トークンのログ |
| TC-DB-013 | 操作ログフィルタ（期間） | 日付範囲でフィルタ |
| TC-DB-014 | 操作ログフィルタ（ネットワーク） | mainnet/testnetでフィルタ |
| TC-DB-015 | 操作ログステータス更新 | pending→success等 |
| **バックアップ** |||
| TC-DB-016 | バックアップ作成 | バックアップファイル生成 |
| TC-DB-017 | バックアップ世代管理（3世代） | 古いバックアップ削除 |

### 3.4 csv-parser.ts - CSVパーサーモジュール 【P1】

**テストファイル:** `src/main/__tests__/csv-parser.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **パース処理** |||
| TC-CSV-001 | 正常なCSV（ヘッダーあり） | address,amountを正しくパース |
| TC-CSV-002 | 正常なCSV（ヘッダーなし） | 自動検出してパース |
| TC-CSV-003 | 空のCSV | 空配列を返す |
| TC-CSV-004 | BOM付きUTF-8 | BOMを除去してパース |
| **バリデーション** |||
| TC-CSV-005 | 無効なアドレス検出 | チェックサム不正を検出 |
| TC-CSV-006 | 無効な数量検出 | 負数・非数値を検出 |
| TC-CSV-007 | 空行のスキップ | 空行を無視 |
| TC-CSV-008 | 重複アドレスの検出 | 重複を警告 |
| **バッチ分割** |||
| TC-CSV-009 | 100件以下のバッチ | 分割なし |
| TC-CSV-010 | 100件超のバッチ分割 | 100件単位で分割 |
| TC-CSV-011 | ちょうど100件の境界 | 正確に分割 |
| **エラーCSV生成** |||
| TC-CSV-012 | 失敗分CSV生成 | 失敗レコードをCSV出力 |

### 3.5 blockchain.ts - ブロックチェーンモジュール 【P1】

**テストファイル:** `src/main/__tests__/blockchain.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **プロバイダー管理** |||
| TC-BC-001 | Mainnetプロバイダー取得 | Polygon Mainnet接続 |
| TC-BC-002 | Testnetプロバイダー取得 | Polygon Amoy接続 |
| TC-BC-003 | RPCフォールバック | プライマリ失敗→セカンダリ |
| **ウォレット操作** |||
| TC-BC-004 | ウォレット作成 | 秘密鍵からウォレット生成 |
| TC-BC-005 | アドレス取得 | 正しいアドレスを返す |
| TC-BC-006 | 残高取得 | MATIC残高を取得 |
| **トークン操作（モック）** |||
| TC-BC-007 | 単発ミント | mint関数呼び出し検証 |
| TC-BC-008 | バッチミント | batchMint関数呼び出し検証 |
| TC-BC-009 | トークンデプロイ | コントラクトデプロイ検証 |
| TC-BC-010 | 権限付与 | grantRole呼び出し検証 |
| TC-BC-011 | 権限剥奪 | revokeRole呼び出し検証 |
| **アドレス検証** |||
| TC-BC-012 | 有効なアドレス | checksumアドレス検証 |
| TC-BC-013 | 無効なアドレス | 不正アドレス拒否 |

### 3.6 config.ts - 設定管理モジュール 【P2】

**テストファイル:** `src/main/__tests__/config.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-CFG-001 | 初期設定の読み込み | デフォルト値で初期化 |
| TC-CFG-002 | 設定の保存 | JSONファイルに保存 |
| TC-CFG-003 | 設定の更新 | 部分更新が可能 |
| TC-CFG-004 | 破損ファイルの処理 | デフォルトにリセット |

### 3.7 logger.ts - ログモジュール 【P3】

**テストファイル:** `src/main/__tests__/logger.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-LOG-001 | ログレベル出力 | debug/info/warn/error |
| TC-LOG-002 | タイムスタンプ形式 | ISO形式で記録 |
| TC-LOG-003 | ファイルローテーション | 10MB超で新ファイル |
| TC-LOG-004 | 世代管理（3世代） | 古いログ削除 |

### 3.8 ipc-handlers.ts - IPCハンドラー 【P1】

**テストファイル:** `src/main/__tests__/ipc-handlers.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **認証系** |||
| TC-IPC-001 | verifyPin呼び出し | 正しくpin-authへ委譲 |
| TC-IPC-002 | changePin呼び出し | PIN変更処理 |
| **ウォレット系** |||
| TC-IPC-003 | getWalletInfo呼び出し | ウォレット情報取得 |
| TC-IPC-004 | importPrivateKey呼び出し | 秘密鍵インポート |
| **トークン系** |||
| TC-IPC-005 | getTokens呼び出し | トークン一覧取得 |
| TC-IPC-006 | deployToken呼び出し | トークンデプロイ |
| TC-IPC-007 | mint呼び出し | ミント実行 |
| TC-IPC-008 | batchMint呼び出し | バッチミント実行 |
| **エラーハンドリング** |||
| TC-IPC-009 | 認証エラー | 適切なエラー応答 |
| TC-IPC-010 | ネットワークエラー | 適切なエラー応答 |

---

## 4. Renderer（フロントエンド）テスト

### 4.1 useApp.ts - メインフック 【P1】

**テストファイル:** `src/renderer/hooks/__tests__/useApp.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **状態管理** |||
| TC-HOOK-001 | 初期状態（loading） | ロード中状態で開始 |
| TC-HOOK-002 | 初回起動（setup状態） | 設定未完了でsetupへ |
| TC-HOOK-003 | 設定済み（pin状態） | PIN入力画面へ |
| TC-HOOK-004 | 認証後（dashboard状態） | ダッシュボードへ |
| **機能** |||
| TC-HOOK-005 | トークン一覧取得 | IPCでトークン取得 |
| TC-HOOK-006 | ネットワーク切替 | 状態とDB連動 |
| TC-HOOK-007 | 言語切替 | i18n言語変更 |
| TC-HOOK-008 | エラーハンドリング | エラー状態の管理 |

### 4.2 PinPage.tsx - PIN入力ページ 【P1】

**テストファイル:** `src/renderer/pages/__tests__/PinPage.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-PIN-001 | PIN入力フィールド表示 | マスク入力が表示 |
| TC-PIN-002 | PIN送信 | 認証APIコール |
| TC-PIN-003 | 認証成功後の遷移 | ダッシュボードへ |
| TC-PIN-004 | 認証失敗表示 | エラーメッセージ |
| TC-PIN-005 | ロックアウト表示 | カウントダウン表示 |

### 4.3 SetupPage.tsx - 初期設定ページ 【P1】

**テストファイル:** `src/renderer/pages/__tests__/SetupPage.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **ステップ1: 秘密鍵** |||
| TC-SETUP-001 | 秘密鍵入力フォーム表示 | 入力欄が表示 |
| TC-SETUP-002 | 有効な秘密鍵入力 | アドレスプレビュー表示 |
| TC-SETUP-003 | 無効な秘密鍵入力 | バリデーションエラー |
| **ステップ2: PIN** |||
| TC-SETUP-004 | PIN設定フォーム表示 | 入力欄2つ表示 |
| TC-SETUP-005 | PIN強度インジケーター | 強度表示が更新 |
| TC-SETUP-006 | PIN不一致エラー | 確認PINとの不一致 |
| **ステップ3: ネットワーク** |||
| TC-SETUP-007 | ネットワーク選択表示 | Mainnet/Testnet選択 |
| TC-SETUP-008 | 確認画面表示 | 設定内容サマリー |
| TC-SETUP-009 | 設定完了 | ダッシュボードへ遷移 |

### 4.4 DashboardPage.tsx - ダッシュボード 【P1】

**テストファイル:** `src/renderer/pages/__tests__/DashboardPage.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| **表示系** |||
| TC-DASH-001 | ウォレットアドレス表示 | 短縮形式で表示 |
| TC-DASH-002 | MATIC残高表示 | 残高数値表示 |
| TC-DASH-003 | トークン一覧表示 | 登録トークンリスト |
| TC-DASH-004 | ネットワーク表示 | Mainnet/Testnet表示 |
| **残高アラート** |||
| TC-DASH-005 | 警告アラート（<1.0 MATIC） | 黄色警告表示 |
| TC-DASH-006 | 危険アラート（<0.1 MATIC） | 赤色危険表示 |
| **ダイアログ起動** |||
| TC-DASH-007 | ミントダイアログ | ダイアログが開く |
| TC-DASH-008 | デプロイダイアログ | ダイアログが開く |
| TC-DASH-009 | トークン追加ダイアログ | ダイアログが開く |

### 4.5 HistoryPage.tsx - 履歴ページ 【P2】

**テストファイル:** `src/renderer/pages/__tests__/HistoryPage.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-HIST-001 | 操作ログ一覧表示 | ログリスト表示 |
| TC-HIST-002 | 操作種別フィルター | deploy/mint等でフィルタ |
| TC-HIST-003 | トークンフィルター | トークン別フィルタ |
| TC-HIST-004 | 期間フィルター | 日付範囲フィルタ |
| TC-HIST-005 | CSVエクスポート | ダウンロード開始 |

### 4.6 SettingsPage.tsx - 設定ページ 【P2】

**テストファイル:** `src/renderer/pages/__tests__/SettingsPage.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-SET-001 | 言語切替 | 日本語/英語切替 |
| TC-SET-002 | ネットワーク切替ダイアログ | 確認ダイアログ表示 |
| TC-SET-003 | アラート閾値設定 | 数値入力と保存 |
| TC-SET-004 | PIN変更ダイアログ | ダイアログ起動 |
| TC-SET-005 | 秘密鍵再インポート | ダイアログ起動 |
| TC-SET-006 | ログフォルダを開く | システムフォルダ開く |

### 4.7 Dialog Components 【P1】

#### MintDialog.tsx
**テストファイル:** `src/renderer/components/__tests__/MintDialog.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-MINT-001 | トークン選択 | ドロップダウン選択 |
| TC-MINT-002 | アドレス入力バリデーション | 無効アドレス検出 |
| TC-MINT-003 | 数量入力バリデーション | 上限超過検出 |
| TC-MINT-004 | ガス見積表示 | 見積金額表示 |
| TC-MINT-005 | 確認ダイアログ | 確認後ミント実行 |
| TC-MINT-006 | ミント成功 | 成功メッセージとTXハッシュ |
| TC-MINT-007 | ミント失敗 | エラーメッセージ表示 |

#### BatchMintDialog.tsx
**テストファイル:** `src/renderer/components/__tests__/BatchMintDialog.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-BATCH-001 | CSVファイル選択 | ファイル選択UI |
| TC-BATCH-002 | CSVプレビュー表示 | パース結果表示 |
| TC-BATCH-003 | 無効行のマーク表示 | 赤色マーク |
| TC-BATCH-004 | スキップオプション | 無効行スキップ |
| TC-BATCH-005 | バッチ進捗表示 | 進捗バー更新 |
| TC-BATCH-006 | 失敗分CSVエクスポート | ダウンロード |

#### DeployTokenDialog.tsx
**テストファイル:** `src/renderer/components/__tests__/DeployTokenDialog.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-DEPLOY-001 | トークン名入力 | バリデーション |
| TC-DEPLOY-002 | シンボル入力 | バリデーション |
| TC-DEPLOY-003 | 小数点桁数設定 | デフォルト18 |
| TC-DEPLOY-004 | 発行上限設定 | 無制限/有限 |
| TC-DEPLOY-005 | 初期発行設定 | 発行量・発行先 |
| TC-DEPLOY-006 | デプロイ費用見積 | 見積表示 |
| TC-DEPLOY-007 | デプロイ実行 | TX送信 |

#### RoleManagementDialog.tsx
**テストファイル:** `src/renderer/components/__tests__/RoleManagementDialog.test.tsx`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-ROLE-001 | 現在のミンター一覧表示 | ミンターリスト |
| TC-ROLE-002 | ミンター追加 | grantRole実行 |
| TC-ROLE-003 | ミンター削除 | revokeRole実行 |
| TC-ROLE-004 | 自分の権限表示 | Admin/Minter表示 |

### 4.8 lib/utils.ts - ユーティリティ関数 【P3】

**テストファイル:** `src/renderer/lib/__tests__/utils.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-UTIL-001 | shortenAddress() | 0x1234...5678形式 |
| TC-UTIL-002 | formatBalance() | 小数点以下桁数 |
| TC-UTIL-003 | copyToClipboard() | クリップボード書込 |
| TC-UTIL-004 | cn() | クラス名マージ |

---

## 5. 統合テスト（E2E）

### 5.1 認証フロー 【P0】

**テストファイル:** `src/__tests__/e2e/auth-flow.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-E2E-001 | 初回起動→設定→ダッシュボード | 全フロー完遂 |
| TC-E2E-002 | 再起動→PIN認証→ダッシュボード | 認証フロー完遂 |
| TC-E2E-003 | ロックアウト→時間経過→再認証 | ロック解除フロー |

### 5.2 トークン管理フロー 【P1】

**テストファイル:** `src/__tests__/e2e/token-flow.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-E2E-004 | トークンデプロイ→ミント | 新規トークンフロー |
| TC-E2E-005 | 既存トークン追加→権限確認 | 追加フロー |
| TC-E2E-006 | バッチミント完遂 | 一括発行フロー |

### 5.3 設定変更フロー 【P2】

**テストファイル:** `src/__tests__/e2e/settings-flow.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-E2E-007 | ネットワーク切替 | Mainnet↔Testnet |
| TC-E2E-008 | PIN変更 | 古PIN→新PIN |
| TC-E2E-009 | 言語切替 | 日本語↔英語 |

---

## 6. スマートコントラクトテスト

### 6.1 MintableToken.sol 【P0】

**テストファイル:** `contracts/test/MintableToken.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-SC-001 | デプロイ成功 | 初期パラメータ設定 |
| TC-SC-002 | mint by MINTER_ROLE | 発行成功 |
| TC-SC-003 | mint by non-minter | 失敗（権限エラー） |
| TC-SC-004 | 発行上限超過 | 失敗（CAP超過） |
| TC-SC-005 | grantRole | 権限付与成功 |
| TC-SC-006 | revokeRole | 権限剥奪成功 |
| TC-SC-007 | decimals設定 | カスタムdecimals |

### 6.2 BatchMinter.sol 【P1】

**テストファイル:** `contracts/test/BatchMinter.test.ts`

| テストケース | 説明 | 検証内容 |
|-------------|------|----------|
| TC-SC-008 | バッチミント成功（100件以下） | 全件発行 |
| TC-SC-009 | バッチミント（100件超） | 失敗（上限超過） |
| TC-SC-010 | 部分失敗時のイベント | 失敗分イベント発行 |
| TC-SC-011 | 権限なしでバッチミント | 失敗（権限エラー） |

---

## 7. テスト実行計画

### 7.1 ディレクトリ構成

```
src/
├── main/
│   └── __tests__/
│       ├── crypto.test.ts
│       ├── pin-auth.test.ts
│       ├── database.test.ts
│       ├── csv-parser.test.ts
│       ├── blockchain.test.ts
│       ├── config.test.ts
│       ├── logger.test.ts
│       └── ipc-handlers.test.ts
├── renderer/
│   ├── hooks/__tests__/
│   │   └── useApp.test.ts
│   ├── pages/__tests__/
│   │   ├── PinPage.test.tsx
│   │   ├── SetupPage.test.tsx
│   │   ├── DashboardPage.test.tsx
│   │   ├── HistoryPage.test.tsx
│   │   └── SettingsPage.test.tsx
│   ├── components/__tests__/
│   │   ├── MintDialog.test.tsx
│   │   ├── BatchMintDialog.test.tsx
│   │   ├── DeployTokenDialog.test.tsx
│   │   └── RoleManagementDialog.test.tsx
│   └── lib/__tests__/
│       └── utils.test.ts
├── __tests__/
│   └── e2e/
│       ├── auth-flow.test.ts
│       ├── token-flow.test.ts
│       └── settings-flow.test.ts
└── __mocks__/
    ├── electron.ts
    ├── ethers.ts
    └── better-sqlite3.ts

contracts/
└── test/
    ├── MintableToken.test.ts
    └── BatchMinter.test.ts
```

### 7.2 モック戦略

| 対象 | モック方法 | 理由 |
|------|-----------|------|
| Electron IPC | vi.mock + カスタムモック | Node API分離 |
| ethers.js | msw + vi.mock | ネットワーク分離 |
| better-sqlite3 | in-memory DB | 高速化 |
| File System | memfs | 環境非依存 |
| Clipboard | vi.mock | システムAPI分離 |

### 7.3 NPM Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --dir src",
    "test:e2e": "vitest run --dir src/__tests__/e2e",
    "test:contracts": "hardhat test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### 7.4 CI/CD統合

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:contracts
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
```

---

## 8. カバレッジ目標

| カテゴリ | 目標カバレッジ | 備考 |
|----------|---------------|------|
| Main Process | 90%+ | セキュリティ関連は100% |
| Renderer Hooks | 85%+ | 状態遷移を重点的に |
| Renderer Pages | 80%+ | UI表示とイベント |
| Renderer Dialogs | 80%+ | フォーム処理 |
| Utils | 100% | 純粋関数 |
| Smart Contracts | 100% | セキュリティクリティカル |

---

## 9. テスト作成順序

### Phase 1: 基盤テスト（優先度P0）

1. `crypto.test.ts` - 暗号化モジュール
2. `pin-auth.test.ts` - PIN認証モジュール
3. `database.test.ts` - データベースモジュール
4. `MintableToken.test.ts` - トークンコントラクト

### Phase 2: コア機能テスト（優先度P1）

5. `csv-parser.test.ts` - CSVパーサー
6. `blockchain.test.ts` - ブロックチェーン連携
7. `ipc-handlers.test.ts` - IPCハンドラー
8. `useApp.test.ts` - メインフック
9. `PinPage.test.tsx` - PIN入力ページ
10. `SetupPage.test.tsx` - 初期設定ページ
11. `DashboardPage.test.tsx` - ダッシュボード
12. ダイアログコンポーネント群
13. `BatchMinter.test.ts` - バッチミントコントラクト

### Phase 3: 補助機能テスト（優先度P2-P3）

14. `HistoryPage.test.tsx` - 履歴ページ
15. `SettingsPage.test.tsx` - 設定ページ
16. `config.test.ts` - 設定管理
17. `logger.test.ts` - ログモジュール
18. `utils.test.ts` - ユーティリティ関数

### Phase 4: 統合テスト

19. E2Eテスト群

---

## 10. 成果物

| 成果物 | 説明 |
|--------|------|
| テストコード | 上記全テストケース |
| vitest.config.ts | テスト設定 |
| モックファイル | Electron/ethers/sqlite |
| CI/CD設定 | GitHub Actions |
| カバレッジレポート | HTML/LCOVフォーマット |

---

## 11. 注意事項

### セキュリティテスト

- 秘密鍵がログに出力されないことを確認
- メモリ上の機密データがクリアされることを確認
- タイミング攻撃対策のテスト

### パフォーマンス考慮

- DB操作は in-memory SQLite を使用
- ネットワーク呼び出しはすべてモック
- 並列実行可能なテスト設計

### 保守性

- テストヘルパー関数の共通化
- フィクスチャーの再利用
- 明確なテストケース命名規則

---

**計画書終わり**
