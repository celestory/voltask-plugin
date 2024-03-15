import {Hono} from 'https://deno.land/x/hono@v3.7.0-rc.1/mod.ts';

import type {Plugin} from '../plugin.ts';

export const createServer = (plugin: Plugin<unknown, unknown>) => {
    // TODO: Better error handling

    const app = new Hono();

    app.get('/', async ctx => {
        const {config: pluginConfig} = await plugin.deriveConfig({});
        return ctx.json({
            manifest: plugin.manifest,
            //
            actions: await Object.entries(plugin.actions).reduce(
                async (actions, [name, action]) => ({
                    ...(await actions),
                    [name]: {
                        manifest: action.manifest,
                        signature: await action.renderBlockSignature({
                            blockConfig: (
                                await action.deriveBlockConfig({
                                    pluginConfig,
                                })
                            ).blockConfig,
                            pluginConfig,
                        }),
                    },
                }),
                Promise.resolve({}),
            ),
            triggers: await Object.entries(plugin.triggers).reduce(
                async (triggers, [name, trigger]) => ({
                    ...(await triggers),
                    [name]: {
                        manifest: trigger.manifest,
                        signature: await trigger.renderBlockSignature({
                            blockConfig: (await trigger.deriveBlockConfig({webhookUrl: '', pluginConfig})).blockConfig,
                        }),
                    },
                }),
                Promise.resolve({}),
            ),
        });
    });

    app.post(`/configSchema`, async ctx => {
        const {form, config} = await ctx.req.json();
        const {renderProps, config: derivedConfig} = await plugin.deriveConfig({form, config});

        return ctx.json({
            config: derivedConfig,
            configSchema: await plugin.renderConfigSchema({renderProps: renderProps, config: derivedConfig}),
        });
    });

    for (const [actionName, action] of Object.entries(plugin.actions)) {
        app.post(`/actions/${actionName}/bestConfig`, async ctx => {
            const {pluginConfigs} = await ctx.req.json();
            const pluginConfigUids = Object.keys(pluginConfigs);

            for (const pluginConfigUid of pluginConfigUids) {
                const {valid} = await action.deriveBlockConfig({pluginConfig: pluginConfigs[pluginConfigUid]!});
                if (valid) {
                    return ctx.json({bestConfigUid: pluginConfigUid});
                }
            }
            return ctx.json({
                bestConfigUid: pluginConfigUids[0],
            });
        });
        app.post(`/actions/${actionName}/blockSchema`, async ctx => {
            const {form, blockConfig, pluginConfig} = await ctx.req.json();
            const {valid, renderProps, blockConfig: derivedBlockConfig} = await action.deriveBlockConfig({form, blockConfig, pluginConfig});

            return ctx.json({
                valid,
                blockConfig: derivedBlockConfig,
                blockConfigSchema: await action.renderBlockConfigSchema({renderProps: renderProps, blockConfig: derivedBlockConfig, pluginConfig}),
                needsPluginConfig: action.manifest.needsPluginConfig,
            });
        });
        app.post(`/actions/${actionName}/blockSignature`, async ctx => {
            const {params, blockConfig, pluginConfig} = await ctx.req.json();

            return ctx.json(await action.renderBlockSignature({params, blockConfig, pluginConfig}));
        });

        app.post(`/actions/${actionName}/executeBlock`, async ctx => {
            try {
                const {params, blockConfig, pluginConfig} = await ctx.req.json();
                switch (action.executeBlock.constructor.name) {
                    case 'Function': {
                        return ctx.json({done: true, value: action.executeBlock({params, blockConfig, pluginConfig})});
                    }
                    case 'AsyncFunction': {
                        return ctx.json({done: true, value: await action.executeBlock({params, blockConfig, pluginConfig})});
                    }
                    case 'GeneratorFunction':
                    case 'AsyncGeneratorFunction': {
                        const generator = await action.executeBlock({params, blockConfig, pluginConfig});
                        return ctx.streamText(async stream => {
                            try {
                                while (true) {
                                    const {done, value} = await (generator as AsyncGenerator).next();

                                    await stream.writeln(JSON.stringify({done, value}));
                                    if (done) {
                                        return;
                                    }
                                }
                            } catch (e) {
                                await stream.writeln(JSON.stringify({done: false, error: {statusCode: 500, message: e.toString()}}));
                                console.error(`/actions/${actionName}/executeBlock`, e);
                            }
                        });
                    }
                    default: {
                        throw new Error(`Cannot run executeBlock: ${action.executeBlock.constructor.name}`);
                    }
                }
            } catch (err) {
                return ctx.json({error: err.toString()}, 400);
            }
        });
    }

    for (const [triggerName, trigger] of Object.entries(plugin.triggers)) {
        app.post(`/triggers/${triggerName}/bestConfig`, async ctx => {
            const {pluginConfigs} = await ctx.req.json();
            const pluginConfigUids = Object.keys(pluginConfigs);

            for (const pluginConfigUid of pluginConfigUids) {
                const {valid} = await trigger.deriveBlockConfig({
                    webhookUrl: 'BEST_CONFIG',
                    pluginConfig: pluginConfigs[pluginConfigUid]!,
                });
                if (valid) {
                    return ctx.json({bestConfigUid: pluginConfigUid});
                }
            }
            return ctx.json({
                bestConfigUid: pluginConfigUids[0],
            });
        });
        app.post(`/triggers/${triggerName}/blockSchema`, async ctx => {
            const {form, webhookUrl, blockConfig, pluginConfig} = await ctx.req.json();
            const {valid, renderProps, blockConfig: derivedBlockConfig} = await trigger.deriveBlockConfig({form, webhookUrl, blockConfig, pluginConfig});

            return ctx.json({
                valid,
                blockConfig: derivedBlockConfig,
                blockConfigSchema: await trigger.renderBlockConfigSchema({renderProps: renderProps, blockConfig: derivedBlockConfig, pluginConfig}),
                needsPluginConfig: trigger.manifest.needsPluginConfig,
            });
        });
        app.post(`/triggers/${triggerName}/blockSignature`, async ctx => {
            const {params, blockConfig, pluginConfig} = await ctx.req.json();

            return ctx.json(await trigger.renderBlockSignature({params, blockConfig, pluginConfig}));
        });
        app.post(`/triggers/${triggerName}/watchBlock`, async ctx => {
            const {webhookUrl, blockConfig, cleanupData, pluginConfig} = await ctx.req.json();

            return ctx.json(await trigger.watchBlock({webhookUrl, blockConfig, cleanupData, pluginConfig}));
        });
        app.delete(`/triggers/${triggerName}/cleanupBlock`, async ctx => {
            const {blockConfig, pluginConfig, cleanupData} = await ctx.req.json();

            return ctx.json(await trigger.cleanupBlock({blockConfig, pluginConfig, cleanupData}));
        });
        app.all(`/triggers/${triggerName}/executeBlock`, async ctx => {
            const blockConfig = JSON.parse(ctx.req.header('X-Voltask-BlockConfig') ?? 'null') ?? undefined;
            const pluginConfig = JSON.parse(ctx.req.header('X-Voltask-PluginConfig') ?? 'null') ?? undefined;
            switch (trigger.executeBlock.constructor.name) {
                case 'Function': {
                    return ctx.json({done: true, value: trigger.executeBlock({request: ctx.req.raw, blockConfig, pluginConfig})});
                }
                case 'AsyncFunction': {
                    return ctx.json({done: true, value: await trigger.executeBlock({request: ctx.req.raw, blockConfig, pluginConfig})});
                }
                case 'GeneratorFunction':
                case 'AsyncGeneratorFunction': {
                    const generator = await trigger.executeBlock({request: ctx.req.raw, blockConfig, pluginConfig});
                    return ctx.streamText(async stream => {
                        try {
                            while (true) {
                                const {done, value} = await (generator as AsyncGenerator).next();

                                await stream.writeln(JSON.stringify({done, value}));
                                if (done) {
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error(`/triggers/${triggerName}/executeBlock`, e);
                            await stream.writeln(JSON.stringify({done: false, error: {statusCode: 500, message: e.toString()}}));
                        }
                    });
                }
                default: {
                    throw new Error(`Cannot run executeBlock: ${trigger.executeBlock.constructor.name}`);
                }
            }
        });
    }

    app.onError((error, ctx) => {
        return ctx.json({error: error.message}, 500);
    });

    return app;
};

export const createServers = (plugins: Record<string, Plugin<unknown, unknown>>) => {
    const app = new Hono();

    for (const [name, plugin] of Object.entries(plugins)) {
        app.route(`/${name}`, createServer(plugin));
    }
    return app;
};
