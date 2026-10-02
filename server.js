const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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';

// ========== 搜索接口 ==========
app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = req.query.type || 'web';

    if (!q) {
        return res.status(400).json({ error: '缺少查询参数 q' });
    }

    try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: q,
                search_depth: 'basic',
                include_answer: false,
                include_images: type === 'images',
                include_raw_content: false,
                max_results: 15,
                topic: type === 'news' ? 'news' : 'general'
            })
        });

        if (!tavilyRes.ok) {
            const errText = await tavilyRes.text();
            console.error('Tavily 返回错误：', tavilyRes.status, errText);
            return res.status(tavilyRes.status).json({
                error: 'Tavily API 请求失败',
                status: tavilyRes.status,
                detail: errText.substring(0, 300)
            });
        }

        const data = await tavilyRes.json();

        const results = (data.results || []).map(item => ({
            title: item.title || '',
            url: item.url || '',
            content: item.content || '',
            score: item.score || 0
        }));

        res.json({
            query: q,
            type: type,
            results: results,
            images: data.images || [],
            response_time: data.response_time || 0
        });

    } catch (e) {
        console.error('搜索服务器错误：', e);
        res.status(500).json({ error: e.message });
    }
});

// ========== 翻译接口（Google translate.googleapis.com） ==========
app.get('/api/translate', async (req, res) => {
    const text = (req.query.text || '').trim();
    const to = req.query.to || 'zh-CN';
    const from = req.query.from || 'auto';

    if (!text) {
        return res.status(400).json({ error: '缺少 text 参数' });
    }

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

        const r = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://translate.google.com/',
                'Origin': 'https://translate.google.com'
            }
        });

        if (!r.ok) {
            return res.status(r.status).json({ error: '翻译服务返回 ' + r.status });
        }

        const data = await r.json();

        // Google 标准返回格式：[[["译文","原文",null,null,...],...], null, "en", ...]
        let translated = '';
        if (Array.isArray(data) && Array.isArray(data[0])) {
            translated = data[0]
                .filter(item => Array.isArray(item) && item[0])
                .map(item => item[0])
                .join('');
        }

        if (!translated) {
            return res.status(500).json({
                error: '翻译结果为空',
                detail: JSON.stringify(data).substring(0, 200)
            });
        }

        res.json({
            text: text,
            translated: translated,
            from: data[2] || from,
            to: to
        });

    } catch (e) {
        console.error('翻译失败：', e);
        res.status(500).json({ error: e.message });
    }
});

// ========== 健康检查 ==========
app.get('/', (req, res) => {
    res.send('Tavily 搜索后端 + 翻译服务 已运行');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
});
