# 簡単トークン発行 - アプリケーション仕様書

**バージョン:** 1.1
**作成日:** 2026年1月13日
**最終更新:** 2026年1月13日
**ステータス:** 改訂版

---

## 1. 概要

### 1.1 プロジェクト概要

「簡単トークン発行」は、一般社団法人の経理担当者がブロックチェーンの専門知識なしにERC20トークンの追加発行（ミント）を行えるデスクトップアプリケーションである。複雑なDAppの操作を排除し、シンプルなUIで報酬用トークンの発行業務を実現する。

### 1.2 アプリケーション名

**簡単トークン発行**（英語名: Easy Token Mint）

### 1.3 対象ユーザー

- 一般社団法人の経理担当者
- 暗号資産（Crypto）の経験がほぼない初心者
- 2〜3名の権限者が各自のPCで運用

### 1.4 主要機能

| 機能 | 説明 |
|------|------|
| トークンデプロイ | OpenZeppelinベースのERC20コントラクトを新規作成・デプロイ |
| トークン発行（ミント） | 指定アドレスへのトークン発行（単発・CSV一括） |
| 権限管理 | ミント権限者の追加・削除 |
| 操作ログ | 発行履歴の記録・CSV出力 |
| ウォレット管理 | 秘密鍵のインポート・暗号化保存・MATIC残高表示 |

---

## 2. 技術仕様

### 2.1 アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    デスクトップアプリ                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Electron  │  │    React    │  │   ethers.js/web3.js │ │
│  │  (メイン)   │  │   (UI)      │  │   (ブロックチェーン) │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              ローカルストレージ（暗号化）               ││
│  │  - 秘密鍵（AES-256-GCM + PIN）                         ││
│  │  - 操作ログ（SQLite）                                  ││
│  │  - 設定ファイル                                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │    Polygon Network            │
              │  - Mainnet (PoS)              │
              │  - Testnet (Amoy)             │
              └───────────────────────────────┘
```

### 2.2 技術スタック

| カテゴリ | 技術 | バージョン |
|----------|------|------------|
| フレームワーク | Electron | 最新安定版 |
| フロントエンド | React + TypeScript | React 18+ |
| UIライブラリ | Tailwind CSS / Shadcn/ui | 最新安定版 |
| ブロックチェーン | ethers.js | v6+ |
| スマートコントラクト | OpenZeppelin Contracts | v5+ |
| ローカルDB | SQLite (better-sqlite3) | 最新安定版 |
| 暗号化 | Node.js crypto (AES-256-GCM) | 組み込み |
| ビルド | electron-builder | 最新安定版 |

### 2.3 対象OS

- Windows 10/11 (64bit)
- macOS 12+ (Intel/Apple Silicon)
- Linux (Ubuntu 20.04+, Debian 11+)

### 2.4 ネットワーク

| ネットワーク | Chain ID | RPC URL | 用途 |
|--------------|----------|---------|------|
| Polygon PoS (Mainnet) | 137 | https://polygon-rpc.com | 本番運用 |
| Polygon Amoy (Testnet) | 80002 | https://rpc-amoy.polygon.technology | テスト・検証 |

---

## 3. スマートコントラクト仕様

### 3.1 ベースコントラクト

OpenZeppelin Contracts v5を使用し、以下の機能を実装する。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MintableToken is ERC20, ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    bool public immutable hasCap;
    uint8 private immutable _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,       // 小数点桁数（通常18）
        uint256 cap,           // 0 = 上限なし
        uint256 initialSupply,
        address initialHolder
    ) ERC20(name, symbol) ERC20Capped(cap == 0 ? type(uint256).max : cap) {
        _decimals = decimals_;
        hasCap = cap > 0;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        if (initialSupply > 0) {
            _mint(initialHolder, initialSupply);
        }
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
```

### 3.2 バッチミントコントラクト

CSV一括発行時に使用するバッチミントコントラクト。1トランザクションで複数のアドレスにミントを実行する。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MintableToken.sol";

contract BatchMinter {
    event BatchMintExecuted(
        address indexed token,
        address indexed operator,
        uint256 totalRecipients,
        uint256 totalAmount
    );

    event MintFailed(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        string reason
    );

    struct MintRequest {
        address recipient;
        uint256 amount;
    }

    /**
     * @notice 複数アドレスへの一括ミント
     * @param token ミント対象のMintableTokenアドレス
     * @param requests ミントリクエストの配列（recipient, amount）
     * @return successCount 成功した件数
     * @return failedIndices 失敗したリクエストのインデックス配列
     */
    function batchMint(
        address token,
        MintRequest[] calldata requests
    ) external returns (uint256 successCount, uint256[] memory failedIndices) {
        require(requests.length > 0, "Empty requests");
        require(requests.length <= 100, "Max 100 requests per batch");

        MintableToken mintableToken = MintableToken(token);

        // 呼び出し元がMINTER_ROLEを持っているか確認
        require(
            mintableToken.hasRole(mintableToken.MINTER_ROLE(), msg.sender),
            "Caller is not a minter"
        );

        uint256[] memory tempFailed = new uint256[](requests.length);
        uint256 failedCount = 0;
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < requests.length; i++) {
            try mintableToken.mint(requests[i].recipient, requests[i].amount) {
                successCount++;
                totalAmount += requests[i].amount;
            } catch Error(string memory reason) {
                tempFailed[failedCount] = i;
                failedCount++;
                emit MintFailed(token, requests[i].recipient, requests[i].amount, reason);
            } catch {
                tempFailed[failedCount] = i;
                failedCount++;
                emit MintFailed(token, requests[i].recipient, requests[i].amount, "Unknown error");
            }
        }

        // 失敗インデックス配列を正しいサイズにコピー
        failedIndices = new uint256[](failedCount);
        for (uint256 i = 0; i < failedCount; i++) {
            failedIndices[i] = tempFailed[i];
        }

        emit BatchMintExecuted(token, msg.sender, successCount, totalAmount);
    }
}
```

**注意事項:**
- BatchMinterコントラクトのアドレスにも`MINTER_ROLE`を付与する必要がある
- 1回のバッチで最大100件まで（ガスリミット考慮）
- 部分的に失敗した場合、成功分は確定し、失敗したインデックスが返却される

### 3.3 デプロイ時設定項目

| 項目 | 型 | 必須 | 説明 |
|------|-----|------|------|
| トークン名 | string | ○ | 例: RewardToken |
| シンボル | string | ○ | 例: RWD |
| 小数点桁数 | uint8 | ○ | デフォルト: 18 |
| 発行上限 | uint256 | △ | 0 = 無制限、任意の値 = 上限あり |
| 初期発行量 | uint256 | △ | 0でも可 |
| 初期発行先 | address | △ | initialSupply > 0 の場合必須 |

### 3.4 権限管理

| ロール | 権限 |
|--------|------|
| DEFAULT_ADMIN_ROLE | MINTER_ROLEの付与・剥奪 |
| MINTER_ROLE | mint関数の実行 |

---

## 4. 画面設計

### 4.1 画面一覧

| 画面ID | 画面名 | 説明 |
|--------|--------|------|
| SCR-001 | PIN入力画面 | アプリ起動時の認証 |
| SCR-002 | 初期設定画面 | 秘密鍵インポート・PIN設定 |
| SCR-003 | ダッシュボード | メイン画面、残高・アラート表示 |
| SCR-004 | トークン発行画面 | 単発・CSV一括発行 |
| SCR-005 | トークン管理画面 | デプロイ・登録済みトークン一覧 |
| SCR-006 | 権限管理画面 | ミンター追加・削除 |
| SCR-007 | 履歴画面 | 操作ログ閲覧・CSVエクスポート |
| SCR-008 | 設定画面 | ネットワーク切替・言語設定・PIN変更 |

### 4.2 画面遷移図

```
起動
  │
  ▼
┌─────────────────┐     初回起動
│  SCR-001        │──────────────▶┌─────────────────┐
│  PIN入力画面    │               │  SCR-002        │
└────────┬────────┘               │  初期設定画面   │
         │PIN認証成功             └────────┬────────┘
         ▼                                  │設定完了
┌─────────────────┐◀────────────────────────┘
│  SCR-003        │
│  ダッシュボード │
├─────────────────┤
│ [発行] [管理] [履歴] [設定]
└──┬───────┬───────┬───────┬──┘
   │       │       │       │
   ▼       ▼       ▼       ▼
SCR-004  SCR-005  SCR-007  SCR-008
         │
         ├───▶ SCR-006（権限管理）
         │
         └───▶ 新規デプロイ
```

### 4.3 画面詳細

#### SCR-001: PIN入力画面

**目的:** アプリ起動時のローカル認証

**UI要素:**
- アプリロゴ
- PIN入力フィールド（8文字以上英数字、マスク表示）
- 「ロック解除」ボタン
- 言語切替（日本語/英語）

**バリデーション:**
- 3回連続失敗で5分間ロック
- ロック中はカウントダウン表示

---

#### SCR-002: 初期設定画面

**目的:** 初回起動時のセットアップ

**ステップ1: 秘密鍵インポート**
- 入力方法選択: テキスト入力 / JSONファイル読み込み
- 秘密鍵入力フィールド（64文字hex）
- アドレスプレビュー表示

**ステップ2: PIN設定**
- 新規PIN入力（8文字以上、英数字混在必須）
- PIN確認入力
- 強度インジケーター（連続文字・辞書単語の警告）

**ステップ3: ネットワーク選択**
- Polygon Mainnet / Amoy Testnet 選択
- 確認画面

---

#### SCR-003: ダッシュボード

**目的:** 状態の一覧表示とクイックアクセス

**UI要素:**

```
┌─────────────────────────────────────────────────────────────┐
│  簡単トークン発行                    [設定] [言語: 日本語▼] │
├─────────────────────────────────────────────────────────────┤
│  ネットワーク: Polygon Mainnet ●                           │
├──────────────────────────┬──────────────────────────────────┤
│  ウォレット              │  管理トークン                    │
│  ─────────────────────── │  ──────────────────────────────  │
│  アドレス: 0x1234...5678 │  ┌────────────────────────────┐  │
│  MATIC残高: 12.5 MATIC   │  │ RWD (RewardToken)          │  │
│                          │  │ 発行済: 1,000,000          │  │
│  ⚠️ 残高が少なくなって   │  │ 上限: 無制限               │  │
│  います                  │  └────────────────────────────┘  │
├──────────────────────────┴──────────────────────────────────┤
│  [トークン発行]  [トークン管理]  [履歴]                     │
└─────────────────────────────────────────────────────────────┘
```

**アラート条件:**
- MATIC残高 < 1.0: 警告表示（黄色）
- MATIC残高 < 0.1: 危険表示（赤色）

---

#### SCR-004: トークン発行画面

**目的:** トークンのミント実行

**タブ構成:**
1. **単発発行タブ**
2. **CSV一括発行タブ**

**単発発行:**
```
┌─────────────────────────────────────────────────────────────┐
│  トークン発行 - 単発                                        │
├─────────────────────────────────────────────────────────────┤
│  トークン: [RewardToken (RWD) ▼]                            │
│                                                             │
│  発行先アドレス: [0x________________________________]       │
│                  ✓ 有効なアドレス                           │
│                                                             │
│  発行量: [_______________] RWD                              │
│                                                             │
│  ガス見積: 約 0.005 MATIC                                   │
│                                                             │
│           [キャンセル]  [発行実行]                          │
└─────────────────────────────────────────────────────────────┘
```

**CSV一括発行:**
```
┌─────────────────────────────────────────────────────────────┐
│  トークン発行 - CSV一括                                     │
├─────────────────────────────────────────────────────────────┤
│  トークン: [RewardToken (RWD) ▼]                            │
│                                                             │
│  CSVファイル: [ファイルを選択] sample.csv                   │
│                                                             │
│  プレビュー:                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ # │ アドレス              │ 数量      │ 状態       │   │
│  ├───┼───────────────────────┼───────────┼────────────┤   │
│  │ 1 │ 0x1234...5678         │ 100       │ ✓ 有効     │   │
│  │ 2 │ 0xabcd...efgh         │ 200       │ ✓ 有効     │   │
│  │ 3 │ invalid_address       │ 50        │ ✗ 無効     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  合計: 3件 (有効: 2件, 無効: 1件)                          │
│  総発行量: 300 RWD                                          │
│  ガス見積: 約 0.015 MATIC                                   │
│                                                             │
│  □ 無効なアドレスをスキップして続行                        │
│                                                             │
│           [キャンセル]  [一括発行実行]                      │
└─────────────────────────────────────────────────────────────┘
```

**CSVフォーマット:**
```csv
address,amount
0x1234567890123456789012345678901234567890,100
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,200
```

**CSV一括発行の処理フロー:**

1. **ファイル読み込み・バリデーション**
   - CSVファイルをパース
   - 各行のアドレス形式・数量を検証
   - 無効な行をマーク表示

2. **バッチ分割**
   - 100件を超える場合、100件単位でバッチに分割
   - 例: 250件 → バッチ1(100件) + バッチ2(100件) + バッチ3(50件)

3. **実行確認**
   - 総件数、総発行量、推定ガス代を表示
   - 「無効なアドレスをスキップ」オプション

4. **バッチ実行**
   - BatchMinterコントラクトを使用して1TX/バッチで実行
   - 各バッチの結果をリアルタイム表示

5. **結果表示**
   ```
   ┌─────────────────────────────────────────────────────────────┐
   │  一括発行結果                                               │
   ├─────────────────────────────────────────────────────────────┤
   │  ✓ バッチ 1/3: 100件成功                     [TX: 0xabc...]│
   │  ✓ バッチ 2/3: 98件成功, 2件失敗             [TX: 0xdef...]│
   │  ⏳ バッチ 3/3: 処理中...                                   │
   ├─────────────────────────────────────────────────────────────┤
   │  合計: 198件成功 / 250件中                                  │
   │  失敗した2件:                                               │
   │  - 行105: 0x1234... (発行上限超過)                          │
   │  - 行142: 0x5678... (ゼロアドレス)                          │
   │                                                             │
   │  [失敗分をCSV出力]  [閉じる]                                │
   └─────────────────────────────────────────────────────────────┘
   ```

6. **リトライ対応**
   - 失敗した行のみを含むCSVをエクスポート可能
   - 再度インポートして再実行

---

#### SCR-005: トークン管理画面

**目的:** トークンの新規デプロイ・登録済みトークン管理

**UI要素:**

**登録済みトークン一覧:**
```
┌─────────────────────────────────────────────────────────────┐
│  トークン管理                                               │
├─────────────────────────────────────────────────────────────┤
│  [+ 新規デプロイ]  [+ 既存トークン追加]                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ RewardToken (RWD)                                    │   │
│  │ Contract: 0x9876...5432                              │   │
│  │ 発行済: 1,000,000 / 上限なし                        │   │
│  │ あなたの権限: Admin, Minter                          │   │
│  │ [権限管理] [詳細] [削除]                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**新規デプロイダイアログ:**
```
┌─────────────────────────────────────────────────────────────┐
│  新規トークンデプロイ                                       │
├─────────────────────────────────────────────────────────────┤
│  トークン名: [__________________________]                   │
│  シンボル:   [________]                                     │
│  小数点桁数: [18▼]                                          │
│                                                             │
│  発行上限:                                                  │
│  ○ 無制限                                                   │
│  ● 上限あり: [_______________]                              │
│                                                             │
│  初期発行:                                                  │
│  □ 初期発行を行う                                           │
│    発行量: [_______________]                                │
│    発行先: [自分のアドレス▼]                                │
│                                                             │
│  デプロイ費用見積: 約 0.05 MATIC                            │
│                                                             │
│           [キャンセル]  [デプロイ]                          │
└─────────────────────────────────────────────────────────────┘
```

**既存トークン追加ダイアログ:**
```
┌─────────────────────────────────────────────────────────────┐
│  既存トークンを追加                                          │
├─────────────────────────────────────────────────────────────┤
│  コントラクトアドレス: [0x________________________________] │
│                                                             │
│  [検証]                                                     │
│                                                             │
│  検証結果:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ ERC20準拠: OK                                      │   │
│  │ ✓ AccessControl対応: OK                              │   │
│  │ ✓ MINTER_ROLE定義: OK                                │   │
│  │                                                       │   │
│  │ トークン名: RewardToken                               │   │
│  │ シンボル: RWD                                         │   │
│  │ 小数点桁数: 18                                        │   │
│  │ 総発行量: 1,000,000 RWD                               │   │
│  │                                                       │   │
│  │ あなたの権限:                                         │   │
│  │ ● MINTER_ROLE: あり                                   │   │
│  │ ○ DEFAULT_ADMIN_ROLE: なし                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ MINTER_ROLEがないと発行操作はできません                 │
│                                                             │
│           [キャンセル]  [追加]                              │
└─────────────────────────────────────────────────────────────┘
```

**既存トークン追加時のバリデーション:**

| チェック項目 | 方法 | 必須 |
|-------------|------|------|
| ERC20準拠 | `name()`, `symbol()`, `decimals()`, `totalSupply()` の呼び出し成功 | ○ |
| AccessControl対応 | `hasRole()` 関数の存在確認 | ○ |
| MINTER_ROLE定義 | `MINTER_ROLE()` の呼び出しと値取得 | ○ |
| ミント権限確認 | `hasRole(MINTER_ROLE, userAddress)` | 警告のみ |
| Admin権限確認 | `hasRole(DEFAULT_ADMIN_ROLE, userAddress)` | 情報表示 |

**権限がない場合の動作:**
- MINTER_ROLEがない場合: 追加は可能だが、発行操作時にエラー表示
- DEFAULT_ADMIN_ROLEがない場合: 権限管理画面で追加・削除ボタンを非表示

---

#### SCR-006: 権限管理画面

**目的:** ミンター権限の追加・削除

```
┌─────────────────────────────────────────────────────────────┐
│  権限管理 - RewardToken (RWD)                               │
├─────────────────────────────────────────────────────────────┤
│  現在のミンター:                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 0x1234...5678 (自分) - Admin, Minter                 │   │
│  │ 0xaaaa...bbbb - Minter                    [削除]     │   │
│  │ 0xcccc...dddd - Minter                    [削除]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ ミンター追加]                                           │
│                                                             │
│  新規ミンター追加:                                          │
│  アドレス: [0x________________________________]             │
│                                                             │
│           [キャンセル]  [追加]                              │
└─────────────────────────────────────────────────────────────┘
```

---

#### SCR-007: 履歴画面

**目的:** 操作ログの閲覧とエクスポート

```
┌─────────────────────────────────────────────────────────────┐
│  操作履歴                                    [CSVエクスポート] │
├─────────────────────────────────────────────────────────────┤
│  フィルター: [全て▼] [全トークン▼] 期間: [____] 〜 [____]  │
├─────────────────────────────────────────────────────────────┤
│  日時              │ 操作     │ トークン │ 詳細           │ TX   │
│  ──────────────────┼──────────┼──────────┼────────────────┼──────│
│  2026/01/13 10:30  │ Mint     │ RWD      │ 100 → 0x1234.. │ [表示]│
│  2026/01/13 10:25  │ Mint     │ RWD      │ 200 → 0xabcd.. │ [表示]│
│  2026/01/12 15:00  │ 権限追加 │ RWD      │ 0xaaaa...      │ [表示]│
│  2026/01/10 09:00  │ デプロイ │ RWD      │ Contract作成   │ [表示]│
└─────────────────────────────────────────────────────────────┘
```

**CSVエクスポート形式:**
```csv
timestamp,operation,token_symbol,token_address,details,tx_hash,operator_address
2026-01-13T10:30:00+09:00,mint,RWD,0x9876...,100 to 0x1234...,0xabcd...,0x1234...
```

---

#### SCR-008: 設定画面

```
┌─────────────────────────────────────────────────────────────┐
│  設定                                                       │
├─────────────────────────────────────────────────────────────┤
│  ネットワーク                                               │
│  ───────────────────────────────────────────────────────── │
│  ● Polygon Mainnet                                          │
│  ○ Polygon Amoy (Testnet)                                   │
│                                                             │
│  言語 / Language                                            │
│  ───────────────────────────────────────────────────────── │
│  [日本語 ▼]                                                 │
│                                                             │
│  セキュリティ                                               │
│  ───────────────────────────────────────────────────────── │
│  [PINを変更]                                                │
│  [秘密鍵を再インポート]                                     │
│                                                             │
│  残高アラート閾値                                           │
│  ───────────────────────────────────────────────────────── │
│  警告: [1.0] MATIC未満                                      │
│  危険: [0.1] MATIC未満                                      │
│                                                             │
│  アプリ情報                                                 │
│  ───────────────────────────────────────────────────────── │
│  バージョン: 1.0.0                                          │
│  [ログフォルダを開く]                                       │
└─────────────────────────────────────────────────────────────┘
```

**ネットワーク切替時の動作:**

| 項目 | 動作 |
|------|------|
| トークン一覧 | 選択中ネットワークに登録されたトークンのみ表示 |
| 操作ログ | 選択中ネットワークのログのみ表示（フィルターで全表示可能） |
| MATIC残高 | 選択中ネットワークでの残高を取得・表示 |
| BatchMinter | ネットワークごとにデプロイ済みアドレスを管理 |

**切替確認ダイアログ:**
```
┌─────────────────────────────────────────────────────────────┐
│  ネットワーク切替の確認                                      │
├─────────────────────────────────────────────────────────────┤
│  Polygon Mainnet → Polygon Amoy (Testnet) に切り替えます    │
│                                                             │
│  ⚠️ 注意:                                                   │
│  - 表示されるトークンが切り替わります                       │
│  - Testnetのトークンには実際の価値はありません              │
│  - 秘密鍵・PINはそのまま使用されます                        │
│                                                             │
│           [キャンセル]  [切り替える]                        │
└─────────────────────────────────────────────────────────────┘
```

**PIN変更フロー:**
1. 現在のPINを入力して認証
2. 新しいPIN（8文字以上、英数字混在）を入力
3. 新しいPINの確認入力
4. 秘密鍵を新しいPINで再暗号化して保存

```
┌─────────────────────────────────────────────────────────────┐
│  PINの変更                                                  │
├─────────────────────────────────────────────────────────────┤
│  現在のPIN: [________________]                              │
│             ✓ 認証成功                                      │
│                                                             │
│  新しいPIN: [________________]                              │
│  (8文字以上、英数字混在必須)                                │
│             強度: ████████░░ 良好                           │
│                                                             │
│  新しいPIN（確認）: [________________]                      │
│             ✓ 一致                                          │
│                                                             │
│           [キャンセル]  [変更]                              │
└─────────────────────────────────────────────────────────────┘
```

**秘密鍵の再インポートフロー:**

再インポート時は既存データ（トークン登録・操作ログ）を保持し、ウォレットアドレスのみ変更する。

1. 現在のPINを入力して認証
2. 新しい秘密鍵をインポート
3. アドレスプレビュー表示
4. 確認後、秘密鍵を現在のPINで暗号化して保存
5. config.jsonのwalletAddressを更新

```
┌─────────────────────────────────────────────────────────────┐
│  秘密鍵の再インポート                                       │
├─────────────────────────────────────────────────────────────┤
│  現在のPIN: [________________]                              │
│             ✓ 認証成功                                      │
│                                                             │
│  現在のアドレス: 0x1234...5678                              │
│                                                             │
│  新しい秘密鍵:                                              │
│  ○ テキスト入力                                             │
│  ● JSONファイル読み込み                                     │
│                                                             │
│  [ファイルを選択] keystore.json                             │
│  パスワード: [________________]                             │
│                                                             │
│  新しいアドレス: 0xabcd...efgh                              │
│                                                             │
│  ⚠️ 注意:                                                   │
│  - 登録済みトークンと操作ログは保持されます                 │
│  - 新しいウォレットにミント権限がない場合、発行できません   │
│  - 旧ウォレットの秘密鍵はアプリから削除されます             │
│                                                             │
│           [キャンセル]  [インポート]                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. データ設計

### 5.1 ローカルストレージ構成

**OS別データディレクトリ:**

| OS | パス |
|----|------|
| Windows | `%APPDATA%\easy-token-mint\` |
| macOS | `~/Library/Application Support/easy-token-mint/` |
| Linux | `~/.config/easy-token-mint/` |

**ディレクトリ構造:**
```
<data-dir>/
├── config.json          # アプリ設定（暗号化なし）
├── wallet.enc           # 秘密鍵（AES-256-GCM暗号化）
├── tokens.db            # SQLiteデータベース
├── backups/             # 自動バックアップ
│   ├── tokens_2026-01-13.db
│   ├── tokens_2026-01-12.db
│   └── tokens_2026-01-11.db
└── logs/
    └── app.log          # アプリケーションログ
```

**OS別ファイル権限:**

| OS | 対象 | 権限 | 説明 |
|----|------|------|------|
| macOS/Linux | データディレクトリ | 700 | 所有者のみフルアクセス |
| macOS/Linux | wallet.enc | 600 | 所有者のみ読み書き |
| macOS/Linux | その他ファイル | 600 | 所有者のみ読み書き |
| Windows | データディレクトリ | ユーザーのみフルコントロール (ACL) | 他ユーザーからのアクセスを拒否 |
| Windows | wallet.enc | ユーザーのみフルコントロール (ACL) | SYSTEM・Administratorsも除外 |

**Windows ACL設定の実装:**
```javascript
// Windows向け: ACLを設定してユーザーのみアクセス可能に
const { execSync } = require('child_process');

function setWindowsAcl(filePath) {
  const username = process.env.USERNAME;
  // 継承を無効化し、現在のユーザーのみにフルコントロールを付与
  execSync(`icacls "${filePath}" /inheritance:r /grant:r "${username}:F"`);
}
```

### 5.2 config.json

```json
{
  "version": "1.0",
  "network": "polygon-mainnet",
  "language": "ja",
  "alertThresholds": {
    "warning": "1.0",
    "danger": "0.1"
  },
  "walletAddress": "0x1234567890123456789012345678901234567890"
}
```

### 5.3 SQLiteスキーマ

```sql
-- 管理トークン
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    cap TEXT,  -- NULL = 無制限
    network TEXT NOT NULL,
    deployed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 操作ログ
CREATE TABLE operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_type TEXT NOT NULL,  -- 'deploy', 'mint', 'grant_role', 'revoke_role'
    token_id INTEGER,
    token_address TEXT,
    token_symbol TEXT,
    details TEXT,  -- JSON形式
    tx_hash TEXT,
    operator_address TEXT NOT NULL,
    network TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'failed'
    error_message TEXT,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- インデックス
CREATE INDEX idx_logs_timestamp ON operation_logs(timestamp);
CREATE INDEX idx_logs_token ON operation_logs(token_id);
CREATE INDEX idx_logs_operation ON operation_logs(operation_type);
```

### 5.4 秘密鍵暗号化仕様

| 項目 | 値 |
|------|-----|
| アルゴリズム | AES-256-GCM |
| 鍵導出 | PBKDF2-SHA256 |
| イテレーション | 600,000回 |
| ソルト | 32バイトランダム |
| IV | 12バイトランダム |
| 認証タグ | 16バイト |

**wallet.enc構造:**
```json
{
  "version": 1,
  "salt": "<base64>",
  "iv": "<base64>",
  "authTag": "<base64>",
  "ciphertext": "<base64>"
}
```

---

## 6. セキュリティ要件

### 6.1 秘密鍵の保護

| 要件 | 対応 |
|------|------|
| 保存時暗号化 | AES-256-GCM + PBKDF2でPINから鍵導出 |
| メモリ上の保護 | 使用後即座にゼロクリア |
| ファイル権限 | macOS/Linux: 600、Windows: ACL（5.1節参照） |
| バックアップ | MetaMask等の元ウォレットに依存 |

### 6.2 PIN認証

| 要件 | 対応 |
|------|------|
| 形式 | 8文字以上、英数字混在必須 |
| 試行制限 | 3回失敗で5分間ロック |
| ロック回数累積 | 連続ロック時は待機時間を倍増（上限30分） |
| 強度チェック | 連続文字・辞書単語の警告表示 |

### 6.3 トランザクション確認

- 発行前に必ず確認ダイアログを表示
- CSV一括発行時はプレビュー必須
- 高額発行時の追加警告（設定可能な閾値）

---

## 7. 技術的リスクと対策

### 7.1 リスク一覧

#### 7.1.1 ローカル環境への攻撃

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| マルウェアによるメモリ読み取り | 高 | 秘密鍵が復号されてメモリ上にある瞬間を狙われる |
| キーロガー | 高 | PIN入力時に傍受される |
| ファイル窃取 | 中 | wallet.encを盗まれた場合、PINの総当たり攻撃が可能 |
| クリップボード監視 | 中 | アドレスのコピペ時に差し替えられる |

#### 7.1.2 Electronの脆弱性

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| 依存パッケージの脆弱性 | 中〜高 | Node.js/Electronエコシステムのサプライチェーン攻撃 |
| 古いChromiumの脆弱性 | 中 | Electron更新を怠ると既知の脆弱性が残る |
| リモートコード実行 | 中 | nodeIntegration設定ミスによるXSS→RCE |

#### 7.1.3 スマートコントラクトのリスク

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| Admin秘密鍵の紛失 | 高 | 全員がAdmin権限を失うとミンター追加不可に |
| コントラクトのバグ | 中 | OpenZeppelinは監査済みだが、カスタム部分にバグの可能性 |
| ガス代高騰 | 低 | Polygonは安定しているが、一括発行時に想定外のコストも |

#### 7.1.4 ネットワーク・通信

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| RPCエンドポイントの信頼性 | 中 | 公開RPCがダウン/改ざんされる可能性 |
| 中間者攻撃 | 低 | HTTPS通信だが、証明書検証の実装ミス |
| フィッシングRPC | 低 | 設定変更で悪意あるRPCに接続させられる |

#### 7.1.5 運用上の技術リスク

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| ローカルDBの破損 | 中 | SQLiteファイルが壊れるとログ消失 |
| バージョン不整合 | 低 | 複数人が異なるバージョンを使用した場合の互換性 |
| PC故障 | 中 | 秘密鍵のバックアップがMetaMask頼みのため復旧遅延 |

### 7.2 リスク評価マトリクス

| リスク | 発生可能性 | 影響度 | 総合評価 |
|--------|------------|--------|----------|
| マルウェア/キーロガー | 低〜中 | 致命的 | **要注意** |
| PINブルートフォース | 低 | 致命的 | **対策実施** |
| Electron脆弱性 | 低 | 高 | 中 |
| Admin鍵紛失 | 低 | 高 | **対策実施** |
| RPC障害 | 中 | 中 | 中 |
| DB破損 | 低 | 低 | 低 |

### 7.3 実装する対策

#### 7.3.1 必須対策（本バージョンで実装）

**① PIN強化**

| 項目 | 旧仕様 | 新仕様 |
|------|--------|--------|
| 形式 | 6桁数字 | 8文字以上、英数字混在必須 |
| 総当たり耐性 | 100万通り | 2兆通り以上（英数62^8） |
| 強度チェック | なし | 連続文字・辞書単語の警告 |

**② Electronセキュリティ設定**

```javascript
// main.js - BrowserWindow設定
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // 必須: Node.js APIを無効化
    contextIsolation: true,        // 必須: コンテキスト分離
    sandbox: true,                 // 必須: サンドボックス有効化
    webSecurity: true,             // 必須: 同一オリジンポリシー
    allowRunningInsecureContent: false,
    enableRemoteModule: false,     // リモートモジュール無効化
  }
});

// CSPヘッダー設定
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://polygon-rpc.com https://rpc-amoy.polygon.technology"
      ].join('; ')
    }
  });
});
```

**③ Admin権限の冗長化ガイドライン**

運用ルールとして以下を推奨（アプリ内ヘルプに記載）：

- デプロイ時、最低2つのアドレスにDEFAULT_ADMIN_ROLEを付与する
- Admin権限者のうち1名は、普段使用しないコールドウォレットを推奨
- Admin権限者リストは組織内で文書管理する

**④ クリップボード自動クリア**

```javascript
// アドレスコピー後、30秒で自動クリア
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  setTimeout(() => {
    navigator.clipboard.writeText('');
  }, 30000);
}
```

**⑤ RPCフォールバック設定**

```javascript
// 複数RPCエンドポイントの自動切り替え
const RPC_ENDPOINTS = {
  'polygon-mainnet': [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.quiknode.pro',
    'https://polygon-mainnet.g.alchemy.com/v2/demo'
  ],
  'polygon-amoy': [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.blockpi.network/v1/rpc/public'
  ]
};

async function getProvider(network) {
  for (const rpc of RPC_ENDPOINTS[network]) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // 接続テスト
      return provider;
    } catch (e) {
      console.warn(`RPC ${rpc} failed, trying next...`);
    }
  }
  throw new Error('All RPC endpoints failed');
}
```

**⑥ SQLiteバックアップ機能**

```javascript
// アプリ起動時に自動バックアップ（直近3世代保持）
function backupDatabase() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const backupPath = `~/.easy-token-mint/backups/tokens_${timestamp}.db`;
  fs.copyFileSync(DB_PATH, backupPath);
  
  // 古いバックアップを削除（3世代保持）
  const backups = fs.readdirSync(BACKUP_DIR).sort().reverse();
  backups.slice(3).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}
```

**⑦ 依存パッケージ監査**

```json
// package.json - CI/CDに組み込み
{
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix",
    "preinstall": "npm audit --audit-level=critical"
  }
}
```

#### 7.3.2 推奨対策（将来バージョンで検討）

**① ハードウェアウォレット対応**

| 対応デバイス | ライブラリ | メリット |
|--------------|------------|----------|
| Ledger Nano S/X | @ledgerhq/hw-app-eth | PCに秘密鍵を保存しない |
| Trezor | trezor-connect | 同上 |

実装時の考慮点：
- USB HID権限の取得（OSごとに異なる）
- トランザクション署名フローの変更
- デバイス未接続時のエラーハンドリング

**② マルチシグ対応**

Gnosis Safeなどのマルチシグウォレットを介したミント実行：
- 2-of-3署名で不正発行を防止
- 実装難易度が高いため、将来検討

**③ 監査ログのクラウドバックアップ**

AWS S3やGoogle Cloud Storageへの暗号化バックアップ：
- 監査証跡の長期保全
- 複数PC間でのログ統合
- ネットワーク接続が必須になるデメリット

### 7.4 ユーザー向けセキュリティガイドライン

アプリ内ヘルプおよび初回起動時に以下を表示：

```
【セキュリティに関する重要なお願い】

1. このアプリをインストールするPCは、信頼できるものを使用してください
   - ウイルス対策ソフトを最新の状態に保つ
   - 不審なソフトウェアをインストールしない
   - OSとブラウザを常に最新に更新する

2. PINは推測されにくいものを設定してください
   - 誕生日、電話番号、連続した数字は避ける
   - 他のサービスと同じパスワードを使い回さない

3. 秘密鍵のバックアップを確実に行ってください
   - MetaMask等の元ウォレットのシードフレーズを安全に保管
   - 複数の場所（物理的に離れた場所）に保管を推奨

4. Admin権限は複数人で管理してください
   - 1人だけがAdmin権限を持つ状態を避ける
   - Admin権限者が退職・異動する場合は事前に引き継ぎを行う

5. 不審な動作があれば使用を中止してください
   - 身に覚えのないトランザクション
   - アプリの異常終了や動作の遅延
   - 不審なエラーメッセージ
```

### 7.5 インシデント対応手順

万が一、秘密鍵の漏洩が疑われる場合：

```
【緊急対応手順】

1. 即座にミント権限を剥奪
   - 別のAdmin権限者がrevokeRole(MINTER_ROLE, 漏洩アドレス)を実行

2. 新しいウォレットを作成
   - 新しい秘密鍵を生成し、アプリに再インポート

3. 新ウォレットに権限を付与
   - grantRole(MINTER_ROLE, 新アドレス)を実行

4. 被害状況の確認
   - 操作ログおよびブロックチェーン上のトランザクション履歴を確認
   - 不正なミントがないかチェック

5. 原因調査
   - 漏洩経路の特定（マルウェア、フィッシング等）
   - 該当PCのセキュリティスキャン実施

6. 再発防止策の実施
   - 必要に応じてハードウェアウォレットの導入を検討
```

### 7.6 運用ガイドライン

#### 7.6.1 バックアップからの復元手順

**データベースの復元:**

1. アプリを終了する
2. 破損した`tokens.db`を別の場所に移動（調査用に保持）
3. `backups/`フォルダから最新のバックアップをコピー
4. ファイル名を`tokens.db`にリネーム
5. アプリを起動して動作確認

```
# macOS/Linuxの場合
cd ~/.config/easy-token-mint/  # Linuxの例
mv tokens.db tokens.db.corrupted
cp backups/tokens_2026-01-12.db tokens.db
```

```powershell
# Windowsの場合
cd %APPDATA%\easy-token-mint
move tokens.db tokens.db.corrupted
copy backups\tokens_2026-01-12.db tokens.db
```

**注意事項:**
- バックアップは起動時に自動作成（直近3世代保持）
- 復元後、バックアップ作成時点以降の操作ログは失われる
- ブロックチェーン上のトランザクションは影響を受けない

#### 7.6.2 アンインストール時のデータ削除

**完全削除が必要な場合:**

| OS | 削除対象 |
|----|----------|
| Windows | `%APPDATA%\easy-token-mint\` フォルダ全体 |
| macOS | `~/Library/Application Support/easy-token-mint/` フォルダ全体 |
| Linux | `~/.config/easy-token-mint/` フォルダ全体 |

**重要:**
- `wallet.enc`には暗号化された秘密鍵が含まれる
- 完全削除する場合は、シュレッダーツールでの上書き削除を推奨
- アンインストーラーはデータフォルダを削除しない（再インストール時の復旧のため）

#### 7.6.3 複数PC間でのトークン情報共有

本アプリはローカル専用設計のため、PC間の自動同期機能はない。
複数PCで同じトークンを管理する場合は以下の手順で対応：

1. 各PCに同じ秘密鍵をインポート
2. 各PCで「既存トークン追加」からコントラクトアドレスを登録
3. 操作ログはPC単位で独立して記録される

**推奨運用:**
- 主担当PCを1台決め、そのPCの操作ログを正として管理
- 定期的に操作ログをCSVエクスポートして共有ストレージに保存
- ブロックチェーン上のイベントログが最終的な正確な記録となる

---

## 8. 多言語対応

### 8.1 対応言語

- 日本語（デフォルト）
- 英語

### 8.2 実装方式

- i18next または react-intl を使用
- 言語ファイルはJSON形式で分離

### 8.3 翻訳キー例

```json
{
  "dashboard.title": "ダッシュボード",
  "dashboard.balance": "MATIC残高",
  "mint.single.title": "トークン発行 - 単発",
  "mint.csv.title": "トークン発行 - CSV一括",
  "alert.lowBalance": "残高が少なくなっています",
  "error.invalidAddress": "無効なアドレスです"
}
```

---

## 9. エラーハンドリング

### 9.1 エラー分類

| カテゴリ | 例 | 対応 |
|----------|-----|------|
| ネットワーク | RPC接続失敗 | リトライ + 代替RPC |
| 残高不足 | MATIC不足 | アラート表示 + 処理中断 |
| 権限エラー | ミント権限なし | エラーメッセージ表示 |
| 入力エラー | 無効なアドレス | バリデーション表示 |
| トランザクション | TX失敗 | 詳細ログ + リトライ案内 |

### 9.2 エラーメッセージ例

```json
{
  "error.network.connection": "ネットワーク接続に失敗しました。インターネット接続を確認してください。",
  "error.balance.insufficient": "MATIC残高が不足しています。現在: {current} MATIC, 必要: {required} MATIC",
  "error.permission.noMintRole": "このトークンのミント権限がありません。",
  "error.address.invalid": "入力されたアドレスは無効です: {address}"
}
```

### 9.3 トランザクション状態とUI表示

トランザクションのライフサイクルに応じたUI状態を管理する。

**トランザクション状態:**

| 状態 | 説明 | UI表示 |
|------|------|--------|
| pending | TX送信済み、承認待ち | スピナー + 「処理中...」 |
| confirming | ブロックに含まれた、確認待ち | プログレス + 「確認中 (1/3)」 |
| success | 十分な確認数に達した | ✓ + 成功メッセージ |
| failed | TX失敗（revert等） | ✗ + エラー詳細 |
| timeout | 一定時間応答なし | 警告 + リトライオプション |

**トランザクション実行中のUI:**
```
┌─────────────────────────────────────────────────────────────┐
│  トランザクション処理中                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⏳ ブロックチェーンで処理中です...                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ステップ 1/3: トランザクション送信      ✓ 完了      │   │
│  │ ステップ 2/3: ブロック承認待ち          ⏳ 処理中   │   │
│  │ ステップ 3/3: 確認完了                  ○ 待機中    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TX Hash: 0x1234...5678                    [Polygonscanで確認]│
│  経過時間: 15秒                                             │
│                                                             │
│  ⚠️ この画面を閉じないでください                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**設定:**
- 確認ブロック数: 3ブロック（約6秒）
- タイムアウト: 5分（300秒）
- ガス価格: ネットワークから自動取得（手動設定なし）

**タイムアウト時の対応:**
```
┌─────────────────────────────────────────────────────────────┐
│  トランザクション確認中                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ トランザクションの応答に時間がかかっています           │
│                                                             │
│  TX Hash: 0x1234...5678                                     │
│  経過時間: 5分12秒                                          │
│                                                             │
│  考えられる原因:                                            │
│  - ネットワークの混雑                                       │
│  - ガス価格が低すぎる可能性                                 │
│                                                             │
│  [Polygonscanで確認]  [待機を続ける]  [閉じる]              │
│                                                             │
│  ※ 閉じても、TXがブロックチェーンで処理されれば            │
│    次回起動時に結果を確認できます                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**アプリ再起動時の未確認TX処理:**
1. 起動時にpending状態のTXをDBから取得
2. ブロックチェーンでTX状態を確認
3. 成功/失敗に応じてDBを更新
4. ユーザーに結果を通知

---

## 10. ビルド・配布

### 10.1 ビルド成果物

| OS | ファイル形式 | 署名 |
|----|--------------|------|
| Windows | .exe (NSIS installer) | コード署名推奨 |
| macOS | .dmg | Apple Developer ID推奨 |
| Linux | .AppImage, .deb | GPG署名推奨 |

### 10.2 自動更新

- electron-updaterによる自動更新機能
- GitHub Releasesを配布元として使用

---

## 11. 開発フェーズ

### Phase 1: MVP（推奨開発期間: 2週間）

- [x] PIN認証
- [x] 秘密鍵インポート・暗号化保存
- [x] 単発ミント機能
- [x] 1トークン管理
- [x] 基本UI（日本語のみ）

### Phase 2: 機能拡充（推奨開発期間: 2週間）

- [x] CSV一括発行
- [x] 複数トークン管理
- [x] トークンデプロイ機能
- [x] 権限管理（追加・削除）
- [x] 操作ログ・CSVエクスポート

### Phase 3: 完成（推奨開発期間: 1週間）

- [x] 英語対応
- [x] Amoyテストネット対応
- [x] 残高アラート
- [x] Windows/macOS/Linuxビルド
- [x] ドキュメント整備

---

## 12. 付録

### 12.1 用語集

| 用語 | 説明 |
|------|------|
| ERC20 | Ethereumのトークン規格 |
| ミント（Mint） | トークンの新規発行 |
| MATIC | Polygon Networkのネイティブトークン（ガス代として使用） |
| OpenZeppelin | セキュリティ監査済みのスマートコントラクトライブラリ |
| AccessControl | OpenZeppelinのロールベースアクセス制御 |

### 12.2 参考リンク

- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- Polygon Documentation: https://docs.polygon.technology/
- ethers.js: https://docs.ethers.org/
- Electron: https://www.electronjs.org/docs

---

**文書終わり**