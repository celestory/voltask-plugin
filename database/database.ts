let pluginDb: DatabaseDriver;

const triggersTablename = 'triggers';
const savedDataTablename = 'saved_data';

type QueryParameter = boolean | number | bigint | string | null | undefined | Date | Uint8Array;

export type QueryParameterSet = Record<string, QueryParameter>;

export interface DatabaseDriver {
    init: () => void;
    execute(query: string): void;
    queryEntries<T>(query: string, args?: QueryParameterSet): T[];
}

export interface Trigger {
    plugin: string;
    trigger: string;
    webhookUrl: string;
    //
    blockConfig: unknown;
    cleanupData: Record<string, unknown>;
    pluginConfig?: unknown;
}

export const initDatabase = (driver: DatabaseDriver) => {
    pluginDb = driver;
    driver.init();
    pluginDb.execute(`
    create table if not exists "${triggersTablename}" (
        "plugin" text,
        "trigger" text,
        "webhookUrl" text,
        "blockConfig" text not null,
        "pluginConfig" text,
        "cleanupData" text,

        unique("plugin", "trigger", "webhookUrl")
    )`);

    pluginDb.execute(`
        create table if not exists "${savedDataTablename}" (
            "id" text,
            "data" text,
            "updatedAt" text,

            unique("id")
        )`);

    return pluginDb;
};

export const getSavedTriggers = (plugin: string, trigger: string) => {
    return pluginDb
        .queryEntries<{plugin: string; trigger: string; webhookUrl: string; blockConfig: string; cleanupData: string; pluginConfig?: string}>(
            `select * from "${triggersTablename}" where "plugin" = :plugin and "trigger" = :trigger`,
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
    cleanupData?: unknown;
    pluginConfig?: unknown;
}) => {
    pluginDb.queryEntries(
        `insert into "${triggersTablename}" ("plugin", "trigger", "webhookUrl", "blockConfig", "pluginConfig", "cleanupData") values(:plugin, :trigger, :webhookUrl, :blockConfig, :pluginConfig, :cleanupData)
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
};

export const forgetTrigger = ({plugin, trigger, webhookUrl}: {plugin: string; trigger: string; webhookUrl: string}) => {
    pluginDb.queryEntries(`delete from "${triggersTablename}" where "plugin" = :plugin and "trigger" = :trigger and "webhookUrl" = :webhookUrl`, {
        plugin,
        trigger,
        webhookUrl,
    });
};

export const saveData = <T>(id: string, data: T) => {
    pluginDb.queryEntries(
        `insert into "${savedDataTablename}" ("id", "data", "updatedAt") values(:id, :data, datetime('now'))
    on conflict do update set
        "data" = :data,
        "updatedAt" = datetime('now')
    `,
        {
            id,
            data: JSON.stringify(data),
        },
    );
};

export const getSavedData = <T>(id: string) => {
    const rows = pluginDb.queryEntries<{id: string; data: string}>(`select * from "${savedDataTablename}" where "id" = :id`, {id});
    if (rows[0]) {
        return JSON.parse(rows[0].data) as T;
    }
    return undefined;
};

export const deleteSavedData = (id: string) => {
    pluginDb.queryEntries(`delete from "${savedDataTablename}" where "id" = :id`, {id});
};
