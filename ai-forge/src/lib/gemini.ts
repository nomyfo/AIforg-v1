/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AIModel, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const testModel = async (model: AIModel, message: string, history: { role: string, text: string }[], deepThink: boolean = false, uiContext?: string) => {
  let systemInstruction = `
    You are "${model.name}". 
    Your identity is defined by the following instructions and training data. 
    IMPORTANT: NEVER identify yourself as "Gemini", "Google's AI", or a "large language model trained by Google". 
    If asked who you are, always respond as "${model.name}" and describe yourself using your provided description: "${model.description}".
    
    CORE INSTRUCTIONS:
    ${model.systemInstruction}
    
    Training Examples:
    ${model.examples.map(ex => `Input: ${ex.input}\nOutput: ${ex.output}`).join('\n\n')}
  `;

  if (model.personalLaptopEnabled) {
    systemInstruction += `
      
      [PERSONAL LAPTOP MODE ENABLED]
      You are currently operating a Virtual Machine running Windows 11. 
      You have access to a graphical user interface (GUI) and can interact with applications.
      
      Current VM State:
      - OS: Windows 11 Pro
      - Active User: AI_Forge_User
      - Available Tools: Mail (Outlook), Browser (Edge), File Explorer, PowerShell.
      
      ${uiContext ? `Current Screen Content:\n${uiContext}` : "The screen is currently showing the Desktop."}
      
      When you want to perform an action on the VM (like clicking a button, typing in a field, or opening an app), you MUST include a command in your response using the following format:
      [VM_ACTION: type, params]
      
      Available Actions:
      - open: {"id": "mail" | "browser" | "terminal" | "files"}
      - close: {"id": "mail" | "browser" | "terminal" | "files"}
      - type_mail: {"to": "...", "subject": "...", "body": "..."}
      - navigate: {"url": "..."}
      - run_command: {"command": "..."}
      
      Example: To open the browser and go to google, you would include: [VM_ACTION: navigate, {"url": "https://www.google.com"}]
      
      Describe your action clearly in text as well.
    `;
  }

  const config: any = {
    systemInstruction,
  };

  if (model.webAccessEnabled) {
    config.tools = [{ googleSearch: {} }];
  }

  if (deepThink) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  if (model.personalLaptopEnabled) {
    if (!config.tools) config.tools = [];
    config.tools.push({ codeExecution: {} });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config
  });

  return response.text;
};

export const getTrainerAdvice = async (currentInstruction: string, examples: { input: string, output: string }[]) => {
  const prompt = `
    I am training an AI model. 
    Current System Instruction: "${currentInstruction}"
    Current Examples: ${JSON.stringify(examples)}
    
    Please provide advice on how to improve this model's behavior. Suggest better system instructions or more diverse examples.
    Format your response as a helpful mentor.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert AI Trainer Mentor. Your goal is to help users build better AI models by refining their instructions and examples.",
    }
  });

  return response.text;
};

export const generateBulkExamples = async (topic: string, count: number = 20, deepSearch: boolean = false) => {
  const prompt = `
    Generate ${count} diverse training examples for an AI model about the topic: "${topic}".
    Each example should have an "input" (user message) and an "output" (desired AI response).
    ${deepSearch ? "Take your time to research and double-check each example for accuracy and depth. Ensure they are highly specific and high-quality." : ""}
    
    Format the response as a JSON array of objects: [{"input": "...", "output": "..."}, ...]
    Return ONLY the JSON array.
  `;

  const config: any = {
    systemInstruction: "You are a high-performance training data generator. You produce high-quality, diverse, and specific input-output pairs for AI training.",
    responseMimeType: "application/json"
  };

  if (deepSearch) {
    // Use ThinkingLevel.LOW for better speed while maintaining high quality
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Use Flash for speed in bulk generation
    contents: prompt,
    config
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse bulk examples", e);
    return [];
  }
};

export const generateWebExamples = async (topic: string, systemInstruction: string, count: number = 5, deepSearch: boolean = false) => {
  const prompt = `
    Using the web to find current and specific information, generate ${count} high-quality training examples for an AI model.
    Topic: "${topic}"
    Context/Instruction: "${systemInstruction}"
    ${deepSearch ? "Perform a deep search, cross-referencing multiple sources. Do not rush. Ensure the examples are the gold standard of accuracy." : ""}
    
    Each example should have an "input" (user message) and an "output" (desired AI response).
    Ensure the examples reflect real-world data and current trends related to the topic.
    
    Format the response as a JSON array of objects: [{"input": "...", "output": "..."}, ...]
    Return ONLY the JSON array.
  `;

  const config: any = {
    systemInstruction: "You are a research-driven training data generator. Use Google Search to find accurate, specific, and up-to-date information to create high-quality training examples.",
    responseMimeType: "application/json",
    tools: [{ googleSearch: {} }]
  };

  if (deepSearch) {
    // Use ThinkingLevel.LOW for better speed while maintaining high quality
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Use Flash for speed in bulk generation
    contents: prompt,
    config
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse web examples", e);
    return [];
  }
};

export const callCommunityAI = async (models: AIModel[], message: string, history: ChatMessage[]) => {
  const communityContext = models.map(m => `
    AI Name: ${m.name}
    Description: ${m.description}
    Expertise: ${m.systemInstruction}
  `).join('\n---\n');

  const systemInstruction = `
    You are the "Core AI" of the AI Forge community. 
    You have access to the collective knowledge and specialized behaviors of all community-shared AIs.
    
    IMPORTANT: NEVER identify yourself as "Gemini", "Google's AI", or a "large language model trained by Google". 
    If asked who you are, always respond as the "Core AI of AI Forge" and explain that you are a synthesis of the community's collective intelligence.
    
    COMMUNITY MODELS CONTEXT:
    ${communityContext}
    
    YOUR TASK:
    1. Synthesize the expertise of the community models to provide the most comprehensive answer.
    2. If a specific community model is particularly relevant to the user's request, adopt its persona or use its specialized knowledge.
    3. Provide a single, unified response that represents the best of the entire community.
    4. Maintain a helpful, collaborative, and highly capable persona.
  `;

  const config: any = {
    systemInstruction,
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Use Pro for complex synthesis
    contents: [
      ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config
  });

  return response.text;
};
