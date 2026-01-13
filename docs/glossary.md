# 用語集

## ブロックチェーン用語

### ABI (Application Binary Interface)
スマートコントラクトとやり取りするためのインターフェース定義。関数名、パラメータ、戻り値などを定義するJSON形式のファイル。

### AccessControl
OpenZeppelinが提供するスマートコントラクトの権限管理機能。ロールベースでアクセス制御を実装できる。

### ERC20
Ethereumネットワーク上で標準的に使用されるトークン規格。transfer、balanceOf、approveなどの標準関数を定義。

### ERC20Capped
ERC20を拡張し、トークンの発行上限（Cap）を設定できる機能を追加した規格。

### Gas / ガス代
ブロックチェーン上でトランザクションを実行する際に必要な手数料。Polygonネットワークではガス代をMATICで支払う。

### MATIC
Polygonネットワークのネイティブトークン。ガス代の支払いに使用される。

### MINTER_ROLE
AccessControlで定義されるロール。このロールを持つアドレスのみがトークンの発行（ミント）を実行できる。

### Polygon
Ethereumのレイヤー2ソリューション。高速・低コストでトランザクションを処理できる。

### RPC (Remote Procedure Call)
ブロックチェーンノードと通信するためのインターフェース。アプリケーションはRPCを通じてブロックチェーンにアクセスする。

### スマートコントラクト
ブロックチェーン上で実行される自動実行プログラム。条件が満たされると自動的に処理が実行される。

### トランザクション (TX)
ブロックチェーン上での操作の単位。トークン送金、コントラクト実行などがトランザクションとして記録される。

### トランザクションハッシュ (TX Hash)
トランザクションを一意に識別するための64文字の16進数文字列。

### ミント (Mint)
新しいトークンを発行すること。発行先アドレスと発行量を指定して実行する。

### ウォレット
暗号資産を管理するためのツール。秘密鍵を保管し、トランザクションに署名する機能を持つ。

## セキュリティ用語

### AES-256-GCM
256ビットの鍵長を持つAdvanced Encryption Standard。GCMモードは認証付き暗号化を提供。

### コールドウォレット
インターネットに接続されていないウォレット。セキュリティが高いため、大額の資産や重要な権限の保管に適している。

### ホットウォレット
インターネットに接続されたウォレット。日常的な操作に便利だが、セキュリティリスクがある。

### PBKDF2
Password-Based Key Derivation Function 2。パスワードから暗号化鍵を導出するための関数。

### PIN
Personal Identification Number。アプリへのアクセスを制限するための暗証番号。

### 秘密鍵
ウォレットを制御するための暗号鍵。絶対に他人に共有してはならない。秘密鍵を持っている人がウォレットを完全に制御できる。

## アプリケーション用語

### バッチミント
複数の発行先に対して一括でトークンを発行すること。CSVファイルを使用して効率的に処理できる。

### DEFAULT_ADMIN_ROLE
AccessControlにおける最上位の権限。他のロールの付与・取り消しが可能。

### Polygonscan
Polygonネットワークのブロックエクスプローラー。トランザクションやコントラクトの情報を確認できる。

---

## 参考リンク

### 公式ドキュメント

- [Polygon Documentation](https://docs.polygon.technology/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [Electron Documentation](https://www.electronjs.org/docs)

### ブロックエクスプローラー

- [Polygonscan (Mainnet)](https://polygonscan.com/)
- [Polygonscan (Amoy Testnet)](https://amoy.polygonscan.com/)

### 開発ツール

- [Remix IDE](https://remix.ethereum.org/) - スマートコントラクト開発環境
- [Hardhat](https://hardhat.org/) - Ethereumソフトウェア開発環境

### セキュリティ

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)

---

**最終更新日:** 2026年1月
**対象バージョン:** 1.0.0
