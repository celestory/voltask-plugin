import {Hono} from 'https://deno.land/x/hono@v3.7.0-rc.1/mod.ts';

import type {Plugin} from '../plugin.ts';

export const createServer = (plugin: Plugin<unknown, unknown>) => {
    // TODO: Better error handling

    const app = new Hono();

    app.get('/', ctx => {
        return ctx.json({
            manifest: plugin.manifest,
            //
            actions: Object.entries(plugin.actions).reduce((actions, [name, action]) => ({...actions, [name]: {manifest: action.manifest}}), {}),
            triggers: Object.entries(plugin.triggers).reduce((triggers, [name, trigger]) => ({...triggers, [name]: {manifest: trigger.manifest}}), {}),
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
            const pluginConfigsIds = Object.keys(pluginConfigs);

            for (const pluginConfigId of pluginConfigsIds) {
                const {valid} = await action.deriveBlockConfig({pluginConfig: pluginConfigs[pluginConfigId]!});
                if (valid) {
                    return ctx.json({bestConfig: pluginConfigId});
                }
            }
            return ctx.json({
                bestConfig: pluginConfigsIds[0],
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
                        while (true) {
                            const {done, value} = await (generator as AsyncGenerator).next();

                            await stream.writeln(JSON.stringify({done, value}));
                            if (done) {
                                return;
                            }
                        }
                    });
                }
                default: {
                    throw new Error(`Cannot run executeBlock: ${action.executeBlock.constructor.name}`);
                }
            }
        });
    }

    for (const [triggerName, trigger] of Object.entries(plugin.triggers)) {
        app.post(`/triggers/${triggerName}/bestConfig`, async ctx => {
            const {pluginConfigs} = await ctx.req.json();
            const pluginConfigsIds = Object.keys(pluginConfigs);

            for (const pluginConfigId of pluginConfigsIds) {
                const {valid} = await trigger.deriveBlockConfig({
                    webhookUrl: 'BEST_CONFIG',
                    pluginConfig: pluginConfigs[pluginConfigId]!,
                });
                if (valid) {
                    return ctx.json({bestConfig: pluginConfigId});
                }
            }
            return ctx.json({
                bestConfig: pluginConfigsIds[0],
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
            const {webhookUrl, blockConfig, pluginConfig} = await ctx.req.json();

            return ctx.json(await trigger.watchBlock({webhookUrl, blockConfig, pluginConfig}));
        });
        app.delete(`/triggers/${triggerName}/cleanupBlock`, async ctx => {
            const {blockConfig, pluginConfig, cleanupData} = await ctx.req.json();

            return ctx.json(await trigger.cleanupBlock({blockConfig, pluginConfig, cleanupData}));
        });
        app.all(`/triggers/${triggerName}/executeBlock`, async ctx => {
            switch (trigger.executeBlock.constructor.name) {
                case 'Function': {
                    return ctx.json({done: true, value: trigger.executeBlock({request: ctx.req.raw})});
                }
                case 'AsyncFunction': {
                    return ctx.json({done: true, value: await trigger.executeBlock({request: ctx.req.raw})});
                }
                case 'GeneratorFunction':
                case 'AsyncGeneratorFunction': {
                    const generator = await trigger.executeBlock({request: ctx.req.raw});
                    return ctx.streamText(async stream => {
                        while (true) {
                            const {done, value} = await (generator as AsyncGenerator).next();

                            await stream.writeln(JSON.stringify({done, value}));
                            if (done) {
                                return;
                            }
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
