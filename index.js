const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// メインページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gemini APIエンドポイント
app.post('/api/analyze', async (req, res) => {
    try {
        const { text, prompt } = req.body;
        
        if (!text || !prompt) {
            return res.status(400).json({ error: 'テキストとプロンプトが必要です' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API Keyが設定されていません' });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API Error:', errorData);
            return res.status(response.status).json({ 
                error: `Gemini API request failed: ${response.status}` 
            });
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return res.status(500).json({ error: 'Gemini APIから有効なレスポンスを取得できませんでした' });
        }

        const content = data.candidates[0].content.parts[0].text;
        
        // JSONの抽出
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Invalid JSON response:', content);
            return res.status(500).json({ error: '有効なJSONレスポンスが取得できませんでした' });
        }

        try {
            const jsonData = JSON.parse(jsonMatch[0]);
            res.json({ vocabulary: jsonData.vocabulary || [] });
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            return res.status(500).json({ error: 'JSONの解析に失敗しました' });
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});