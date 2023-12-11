import {JSONSchema, FromObjectSchema} from './schema.ts';

interface TriggerReturns<BlockSignature extends PluginTriggerBlockSignature> {
    values: FromObjectSchema<BlockSignature['returns']['values']>;
    outputId: string;
}

interface TriggerDeriveBlockConfig<BlockConfig, RenderProps> {
    valid: boolean;
    blockConfig: BlockConfig;
    renderProps: RenderProps;
}

export interface PluginTriggerBlockSignature {
    outputs: string[];
    //
    returns: {order: string[]; values: Record<string, JSONSchema>};
}

export interface PluginTrigger<
    CleanupData,
    BlockConfig,
    PluginConfig,
    BlockSignature extends PluginTriggerBlockSignature,
    //
    RenderProps = unknown,
    NeedPluginConfig extends boolean = boolean,
    PluginConfigIfNeeded = NeedPluginConfig extends true ? {pluginConfig: PluginConfig} : object,
    //
    SignedTriggerReturns extends TriggerReturns<BlockSignature> = TriggerReturns<BlockSignature>,
> {
    manifest: {
        title: string;
        color: string;
        iconUrl: string;
        description: string;
        needsPluginConfig: boolean;
    };
    //
    deriveBlockConfig: (
        args: {
            form?: unknown;
            webhookUrl: string;
            blockConfig?: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => TriggerDeriveBlockConfig<BlockConfig, RenderProps> | Promise<TriggerDeriveBlockConfig<BlockConfig, RenderProps>>;
    renderBlockConfigSchema: (
        args: {
            renderProps: RenderProps;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => JSONSchema | Promise<JSONSchema>;
    renderBlockSignature: (
        args: {
            params?: Record<string, unknown>;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => BlockSignature | Promise<BlockSignature>;
    //
    watchBlock: (
        //
        args: {
            webhookUrl: string;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => CleanupData | Promise<CleanupData>;
    cleanupBlock: (
        //
        args: {
            cleanupData: CleanupData;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => void | Promise<void>;
    //
    executeBlock: (
        //
        args: {
            request: Request;
        },
    ) =>
        | SignedTriggerReturns
        | Promise<SignedTriggerReturns>
        | Generator<SignedTriggerReturns, SignedTriggerReturns | undefined>
        | AsyncGenerator<SignedTriggerReturns, SignedTriggerReturns | undefined>;
}

export const createPluginTrigger =
    <CleanupData, BlockConfig, PluginConfig, BlockSignature extends PluginTriggerBlockSignature = PluginTriggerBlockSignature>() =>
    <RenderProps, NeedPluginConfig extends boolean>(
        trigger: PluginTrigger<CleanupData, BlockConfig, PluginConfig, BlockSignature, RenderProps, NeedPluginConfig>,
    ) =>
        trigger as PluginTrigger<unknown, unknown, unknown, PluginTriggerBlockSignature>;
