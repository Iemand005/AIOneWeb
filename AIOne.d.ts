export interface AIOneOptions {
    workerUrl?: string;
    runtimeUrl?: string;
    wasmUrl?: string;
    name?: string;
    threads?: boolean;
    workerType?: "shared" | "dedicated";
}

export default class AIOne {
    static create(options?: AIOneOptions): Promise<AIOne>;

    loadModel(file: File): Promise<void>;
    generate(
        prompt: string,
        maxTokens?: number,
        onToken?: (token: string) => void
    ): Promise<string>;
    unloadModel(): Promise<void>;
    close(): void;
}

export interface Message {
    role: "user" | "assistant";
    content: string;
}