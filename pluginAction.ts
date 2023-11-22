import {JSONSchema} from './schema.ts';

interface ActionParams {
    values: Record<string, unknown>;
    inputId: string;
}

interface ActionReturns {
    values: Record<string, unknown>;
    outputId: string;
}

interface ActionDeriveBlockConfig<BlockConfig, RenderProps> {
    valid: boolean;
    blockConfig: BlockConfig;
    renderProps: RenderProps;
}

export interface PluginActionBlockSignature {
    inputs: string[];
    outputs: string[];
    //
    params: {order: string[]; values: Record<string, JSONSchema>};
    returns: {order: string[]; values: Record<string, JSONSchema>};
}

export interface PluginAction<
    BlockConfig,
    PluginConfig,
    BlockSignature extends PluginActionBlockSignature,
    //
    RenderProps = unknown,
    NeedPluginConfig extends boolean = boolean,
    PluginConfigIfNeeded = NeedPluginConfig extends true ? {pluginConfig: PluginConfig} : object,
> {
    manifest: {
        title: string;
        color: string;
        iconUrl: string;
        description: string;
        needsPluginConfig: NeedPluginConfig;
    };
    //
    deriveBlockConfig: (
        args: {
            form?: unknown;
            blockConfig?: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => ActionDeriveBlockConfig<BlockConfig, RenderProps> | Promise<ActionDeriveBlockConfig<BlockConfig, RenderProps>>;
    renderBlockConfigSchema: (
        args: {
            renderProps: RenderProps;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => JSONSchema | Promise<JSONSchema>;
    //
    renderBlockSignature: (
        args: {
            params?: Record<string, unknown>;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => BlockSignature | Promise<BlockSignature>;
    //
    executeBlock: (
        //
        args: {
            params: ActionParams;
            blockConfig: BlockConfig;
        } & PluginConfigIfNeeded,
    ) => ActionReturns | Promise<ActionReturns> | Generator<ActionReturns, ActionReturns> | AsyncGenerator<ActionReturns, ActionReturns>;
}

export const createPluginAction =
    <BlockConfig, PluginConfig, BlockSignature extends PluginActionBlockSignature = PluginActionBlockSignature>() =>
    <RenderProps, NeedPluginConfig extends boolean>(action: PluginAction<BlockConfig, PluginConfig, BlockSignature, RenderProps, NeedPluginConfig>) =>
        action as PluginAction<unknown, unknown, PluginActionBlockSignature>;
