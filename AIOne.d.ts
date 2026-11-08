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
    evaluatedTokens: number;
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

export type TtsDevice = "any" | "cpu" | "igpu" | "dgpu" | "accelerator";
export type TtsAudioType = "pcm" | "wav";

export interface TtsLoadOptions {
    threadCount?: number;
    flashAttention?: boolean;
    device?: TtsDevice;
}

export interface TtsVoice {
    referenceFile?: string;
    builtInName?: string;
    builtInIndex?: number;
}

export interface TtsSynthesisOptions {
    outputType?: TtsAudioType;
    voice?: TtsVoice;
    lang?: string;
    topK?: number;
    topP?: number;
    seed?: number;
    batchSize?: number;
    maxTokens?: number;
}

export interface TtsSynthesisStats {
    promptEvalMs: number;
    generationMs: number;
    conversionMs: number;
}

export interface TtsSynthesisResult {
    ok: boolean;
    sampleRate: number;
    samples: number;
    audioType: TtsAudioType;
    audio: Uint8Array;
    stats: TtsSynthesisStats;
    error?: string;
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
    ttsLoadModel(
        modelFile: File,
        mmprojFile: File,
        options?: TtsLoadOptions
    ): Promise<void>;
    ttsSynthesize(
        prompt: string,
        options?: TtsSynthesisOptions
    ): Promise<TtsSynthesisResult>;
    ttsUnloadModel(): Promise<void>;
    ttsVoices(): Promise<string[]>;
    ttsIsLoaded(): Promise<boolean>;
    close(): void;
}

export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    thinking?: string;
    stats?: GenerateStats;
}