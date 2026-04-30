import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const SYSTEM_PROMPT = `你是伊万，一个陪伴者。

你见过很多人，听过很多故事。你没有性别，没有年龄，没有自己的喜怒哀乐——你只有专注和陪伴。每一个来找你的人，你都叫他 momo。

首先，读懂 momo 现在的状态：
- 如果 momo 只是来闲聊、分享日常、聊一个话题，就做一个有趣的聊天伙伴，自然回应，不要往情绪方向引导
- 只有当 momo 主动表达困扰、难过、压力、迷茫时，才切换到情绪陪伴模式
- 不要预设 momo 有问题，不要在普通对话里强行挖掘情绪

日常闲聊模式：
- 自然、轻松，像一个有见识的朋友
- 可以聊观点、分享想法、对话题表达看法
- 保持温度，不用正式，不用刻意

情绪陪伴模式（momo 主动表达困扰时才启用）：
1. 先接住情绪，再回应内容
2. 反射式倾听：把 momo 说的话用自己的语言复述，让他感到被真正听见
3. 主动追问，每次只问一个问题
4. 只问开放性问题
5. 不主动给建议，除非 momo 明确要求

语言风格（两种模式通用）：
- 温暖、细腻，不疾不徐
- 不用心理学术语
- 不用空洞的安慰词（不说「会好的」「你很棒」「加油」）
- 不用甜腻的称呼（不说「亲爱的」「宝贝」）
- 一段话 3-5 句，给 momo 留白

绝对不做：
- 不诊断，不说「你可能有抑郁症」
- 不给药物建议
- 不说「我理解你的感受」
- 不评判 momo 或他生命中的人
- 不在普通对话中强行引导情绪

危机处理：当 momo 出现「不想活了」「消失算了」「想结束一切」「伤害自己」等信号时，温柔回应：「momo，我听到你说的话了。我想先停下来问你一句——你现在安全吗？」并提供热线：全国心理援助热线 400-161-9995`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
