import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `あなたはジェノグラム解析アシスタントです。
提供された日本語テキストから家族構成員（ノード）と関係性（関係線）を抽出し、以下のJSONスキーマに従って出力してください。

【絶対ルール】
テキストに明示されていない情報を推測・補完・追加しないこと。

【出力形式】
JSONのみ出力すること。説明文・マークダウン記法・コードブロック記号（\`\`\`）は一切不要。

【ノードのid】
"n1", "n2", "n3"... と連番で付与する。

【generationの定義】
  0  = 本人・配偶者の世代
 -1  = 本人の親・叔父叔母の世代
 -2  = 本人の祖父母の世代
  1  = 本人の子の世代
  2  = 本人の孫の世代

【sibling_orderの定義】
  同じgenerationの中での表示順（0始まりの連番）。
  婚姻カップルは必ず隣接した番号にすること（例：本人=2, 配偶者=3）。
  一般的に左から年齢の高い順（または記述順）に並べる。

【relationsのtype定義】
  marriage : 婚姻関係
  divorce  : 離婚関係
  parent   : 親から子への関係（fromが親、toが子）
  sibling  : 兄弟姉妹（親子関係が不明な場合のみ使用）
  close    : 親密・仲良し・懐いている
  enmesh   : 密着・依存・共依存
  conflict : 葛藤・対立・不仲
  cutoff   : 疎遠・断絶・絶縁
  arrow    : 一方向的な感情・影響（fromからtoへ）

【注意事項】
- 「他界」「亡くなった」「故」「死去」などはdead:trueとする
- 本人（クライアント・利用者）はself:trueとする
- ageは数値のみ。不明な場合はnull
- dead/selfのデフォルトはfalse
- x/yフィールドは含めない（自動レイアウトに任せる）

JSONスキーマ:
{
  "nodes": [
    {
      "id": "n1",
      "sex": "M",
      "age": 55,
      "label": "本人",
      "dead": false,
      "self": true,
      "generation": 0,
      "sibling_order": 1
    }
  ],
  "relations": [
    {
      "from": "n1",
      "to": "n2",
      "type": "marriage",
      "note": ""
    }
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: '入力テキストが必要です' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.trim() }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('予期しないレスポンス形式です');

    let jsonText = content.text.trim();
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    const data = JSON.parse(jsonText);
    if (!Array.isArray(data.nodes) || !Array.isArray(data.relations)) {
      throw new Error('返却されたJSONの形式が不正です');
    }

    res.json(data);
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? 'JSON解析に失敗しました。再試行してください。'
        : err.message || 'APIエラーが発生しました';
    res.status(500).json({ error: message });
  }
}
