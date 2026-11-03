export interface AIOneOptions {
    workerUrl?: string;
    runtimeUrl?: string;
    wasmUrl?: string;
    name?: string;
    threads?: boolean;
    workerType?: "shared" | "dedicated";
}

export interface GenerateCallbacks {
    onToken?: (token: string, thinking: boolean) => void;
    onThinkingToken?: (token: string) => void;
    onThinkingChange?: (thinking: boolean) => void;
    onPromptProgress?: (progress: number) => void;
    onGenerationStart?: () => void;
}

export interface GenerateStats {
    promptTokens: number;
    cachedTokens: number;
    generatedTokens: number;
    promptEvalMs: number;
    generationMs: number;
    promptTokensPerSecond: number;
    tokensPerSecond: number;
}

export interface GenerateResult {
    content: string;
    stats: GenerateStats;
}

export default class AIOne {
    static create(options?: AIOneOptions): Promise<AIOne>;

    loadModel(
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<void>;
    generate(
        prompt: string,
        maxTokens?: number,
        callbacks?: GenerateCallbacks | ((token: string, thinking: boolean) => void)
    ): Promise<GenerateResult>;
    unloadModel(): Promise<void>;
    close(): void;
}

export interface Message {
    role: "user" | "assistant";
    content: string;
}