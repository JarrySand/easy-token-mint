# Easy Token Mint

Polygon（MATIC）ネットワーク上でERC20トークンを管理・発行するためのデスクトップアプリケーションです。

## 機能

- **トークンのデプロイ** - カスタムERC20トークンの新規作成（発行上限設定可能）
- **トークンの発行（ミント）** - 指定アドレスへのトークン発行
- **バッチミント** - CSVファイルを使用した一括発行（最大100件/トランザクション）
- **権限管理** - MINTER_ROLEの付与・取り消し
- **操作履歴** - 全トランザクションの記録・CSV出力
- **マルチネットワーク対応** - Polygon Mainnet / Amoy Testnet

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| デスクトップフレームワーク | Electron |
| フロントエンド | React + TypeScript |
| ビルドツール | Vite |
| スタイリング | TailwindCSS |
| ブロックチェーン連携 | ethers.js |
| スマートコントラクト | Solidity (OpenZeppelin) |
| データベース | SQLite (better-sqlite3) |
| 国際化 | i18next (日本語/英語) |

## セキュリティ

- **秘密鍵の暗号化** - AES-256-GCM + PBKDF2（600,000イテレーション）
- **PIN認証** - アプリアクセス時の二重保護
- **Electronセキュリティ強化** - CSP、コンテキスト分離、サンドボックス有効化

## インストール

### ダウンロード（一般ユーザー向け）

[**Releases**](https://github.com/JarrySand/easy-token-mint/releases/latest)から最新版をダウンロードしてください。

| OS | ファイル | 状態 |
|----|----------|------|
| Windows | `Easy Token Mint Setup x.x.x.exe` | ✅ 利用可能 |
| macOS | `.dmg` | 🚧 準備中 |
| Linux | `.AppImage` / `.deb` | 🚧 準備中 |

#### Windows版のインストール手順

1. [Releases](https://github.com/JarrySand/easy-token-mint/releases/latest)ページから `Easy Token Mint Setup x.x.x.exe` をダウンロード
2. ダウンロードしたファイルをダブルクリックして実行
3. **Windows SmartScreenの警告が表示された場合**：
   - 「詳細情報」をクリック
   - 「実行」をクリック

   > ⚠️ この警告は、アプリがコード署名されていないために表示されます。セキュリティ上の問題ではありません。

4. インストーラーの指示に従ってインストール
5. インストール完了後、デスクトップまたはスタートメニューから起動

### 開発環境でのセットアップ（開発者向け）

```bash
# リポジトリをクローン
git clone https://github.com/JarrySand/easy-token-mint.git
cd easy-token-mint

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## コマンド

```bash
# 開発
npm run dev          # 開発サーバー起動（Vite + Electron）

# ビルド
npm run build        # プロダクションビルド
npm run dist:win     # Windowsインストーラー作成
npm run dist:mac     # macOSパッケージ作成
npm run dist:linux   # Linuxパッケージ作成

# テスト・品質管理
npm run test         # ユニットテスト
npm run typecheck    # 型チェック
npm run lint         # Lint実行

# スマートコントラクト
npm run compile      # コントラクトコンパイル
npm run test:contracts # コントラクトテスト
```

## プロジェクト構成

```
easy-token-mint/
├── src/
│   ├── main/              # Electronメインプロセス
│   │   ├── index.ts       # エントリーポイント
│   │   ├── blockchain.ts  # ブロックチェーン操作
│   │   ├── database.ts    # SQLiteデータベース
│   │   ├── crypto.ts      # 暗号化処理
│   │   └── ...
│   ├── renderer/          # Reactフロントエンド
│   │   ├── pages/         # ページコンポーネント
│   │   ├── components/    # UIコンポーネント
│   │   └── ...
│   ├── preload/           # プリロードスクリプト
│   └── shared/            # 共通型定義
├── contracts/             # Solidityスマートコントラクト
│   ├── MintableToken.sol  # ERC20トークン
│   └── BatchMinter.sol    # バッチ発行コントラクト
├── docs/                  # ドキュメント
└── test/                  # コントラクトテスト
```

## スマートコントラクト

### MintableToken

ERC20トークンにミント機能とアクセス制御を追加したコントラクトです。

- ERC20標準準拠
- オプションの発行上限（Cap）
- ロールベースのアクセス制御（MINTER_ROLE / DEFAULT_ADMIN_ROLE）

### BatchMinter

複数アドレスへの一括発行を効率化するユーティリティコントラクトです。

- 1トランザクションで最大100件の発行
- 個別エラーハンドリング（失敗しても継続）

## データ保存場所

アプリケーションデータは以下の場所に保存されます：

| OS | パス |
|----|------|
| Windows | `%APPDATA%\easy-token-mint\` |
| macOS | `~/Library/Application Support/easy-token-mint/` |
| Linux | `~/.config/easy-token-mint/` |

保存されるファイル：
- `config.json` - 設定ファイル
- `wallet.enc` - 暗号化された秘密鍵
- `data.db` - 操作ログ・トークン情報

## ドキュメント

詳細なドキュメントは[docs](./docs/)フォルダを参照してください。

- [運用ガイドライン](./docs/operation-guidelines.md) - 日常運用・バックアップ・復元
- [セキュリティガイドライン](./docs/security-guidelines.md) - 秘密鍵管理・PIN設定・緊急時対応
- [Admin権限冗長化ガイドライン](./docs/admin-redundancy-guidelines.md) - 権限の冗長化
- [インシデント対応手順](./docs/incident-response.md) - 緊急時の対応フロー
- [用語集](./docs/glossary.md) - ブロックチェーン・セキュリティ用語

## ライセンス

MIT License
