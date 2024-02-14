import {DB} from 'https://deno.land/x/sqlite@v3.8/mod.ts';

let pluginDb: DB;

const dbFileName = 'plugin.sqlite';
const tableName = 'triggers';

export interface Trigger {
    plugin: string;
    trigger: string;
    webhookUrl: string;
    //
    blockConfig: unknown;
    cleanupData: Record<string, unknown>;
    pluginConfig?: unknown;
}

const getPluginDbInstance = () => {
    if (pluginDb) {
        return pluginDb;
    }
    pluginDb = new DB(dbFileName);
    pluginDb.execute(`
    create table if not exists "${tableName}" (
        "plugin" text,
        "trigger" text,
        "webhookUrl" text,
        "blockConfig" text not null,
        "pluginConfig" text,
        "cleanupData" text,

        unique("plugin", "trigger", "webhookUrl")
    )`);
    return pluginDb;
};

export const hasPluginDb = () => {
    try {
        new DB(dbFileName, {mode: 'read'});
        return true;
    } catch (_) {
        return false;
    }
};

export const getSavedTriggers = (plugin: string, trigger: string) => {
    const db = getPluginDbInstance();

    return db
        .queryEntries<{plugin: string; trigger: string; webhookUrl: string; blockConfig: string; cleanupData: string; pluginConfig?: string}>(
            `select * from "${tableName}" where "plugin" = :plugin and "trigger" = :trigger`,
            {plugin, trigger},
        )
        .map<Trigger>(({plugin, trigger, blockConfig, webhookUrl, cleanupData, pluginConfig}) => ({
            plugin,
            trigger,
            webhookUrl,
            blockConfig: JSON.parse(blockConfig),
            cleanupData: JSON.parse(cleanupData),
            pluginConfig: pluginConfig ? JSON.parse(pluginConfig) : undefined,
        }));
};

export const rememberTrigger = ({
    plugin,
    trigger,
    webhookUrl,
    blockConfig,
    cleanupData,
    pluginConfig,
}: {
    plugin: string;
    trigger: string;
    webhookUrl: string;
    blockConfig: unknown;
    cleanupData?: Record<string, unknown>;
    pluginConfig?: unknown;
}) => {
    const db = getPluginDbInstance();
    const returnCleanupData = {
        ...cleanupData,
        plugin,
        trigger,
        webhookUrl,
    };

    db.query(
        `insert into "${tableName}" ("plugin", "trigger", "webhookUrl", "blockConfig", "pluginConfig", "cleanupData") values(:plugin, :trigger, :webhookUrl, :blockConfig, :pluginConfig, :cleanupData)
    on conflict do update set
        "blockConfig" = :blockConfig,
        "cleanupData" = :cleanupData,
        "pluginConfig" = :pluginConfig
    `,
        {
            plugin,
            trigger,
            webhookUrl,
            blockConfig: JSON.stringify(blockConfig),
            cleanupData: JSON.stringify(cleanupData),
            pluginConfig: JSON.stringify(pluginConfig),
        },
    );

    return returnCleanupData;
};

export const forgetTrigger = ({cleanupData}: {cleanupData: Record<string, unknown>}) => {
    const db = getPluginDbInstance();
    if (cleanupData.webhookUrl && cleanupData.plugin && cleanupData.trigger) {
        db.query(`delete from "${tableName}" where "plugin" = :plugin and "trigger" = :trigger and "webhookUrl" = :webhookUrl`, {
            plugin: cleanupData.plugin as string,
            trigger: cleanupData.trigger as string,
            webhookUrl: cleanupData.webhookUrl as string,
        });
    } else {
        console.error(`forgetWatch: cleanupData ${JSON.stringify(cleanupData, null, 2)} does not have the required fields`);
    }
};
