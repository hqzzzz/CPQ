
import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";

// Safe API Key access
const getApiKey = () => {
  // Check for Vite env, then Node env
  const meta = import.meta as any;
  if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_API_KEY) {
      return meta.env.VITE_API_KEY;
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
  }
  return '';
};

const API_KEY = getApiKey();

// Initialize the Gemini AI client only if key exists, otherwise handle gracefully in functions
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const generateProductDescription = async (name: string, category: string, features: string): Promise<string> => {
  if (!ai) {
    console.warn("未找到 API Key，返回模拟描述。");
    return `[AI 模拟] 专为 ${category} 设计的高品质 ${name}。主要特点：${features}。`;
  }

  try {
    const model = 'gemini-3-flash-preview';
    const prompt = `请用中文写一段专业、以销售为导向的产品描述（最多50字）。产品名称："${name}"，类别："${category}"。主要特点：${features}。`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "描述生成失败。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成描述时发生错误，请重试。";
  }
};

export const analyzeQuote = async (products: Product[]): Promise<string> => {
    if (!ai) return "AI 分析需要有效的 API Key。";

    try {
        const productList = products.map(p => `${p.name} (¥${p.basePrice})`).join(', ');
        const prompt = `分析此销售报价中的产品列表：${productList}。建议2个适合企业客户的追加销售机会或互补产品。请用中文回答，保持简短。`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || "暂无分析建议。";
    } catch (error) {
        console.error("Gemini API Error", error);
        return "无法生成分析结果。";
    }
}
