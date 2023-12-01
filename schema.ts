// eslint-disable-next-line @typescript-eslint/ban-types
export type JSONSchemaAny = {
    type?: never;
    title?: string;
    default?: never;
};

export type JSONSchemaNumber = {
    type: 'number';
    title?: string;
    default?: number;
};

export type JSONSchemaString = {
    type: 'string';
    enum?: string[];
    title?: string;
    default?: string;
};

export type JSONSchemaBoolean = {
    type: 'boolean';
    title?: string;
    default?: boolean;
};

export type JSONSchemaArray = {
    type: 'array';
    items?: JSONSchema;
    title?: string;
    default?: unknown[];
    minItems?: number;
    maxItems?: number;
    prefixItems?: JSONSchema[];
    uniqueItems?: boolean;
};

export type JSONSchemaObject = {
    type: 'object';
    title?: string;
    default?: object;
    required?: readonly string[];
    properties: Record<string, JSONSchema>;
    additionalProperties?: boolean;
};

export type JSONSchema = JSONSchemaAny | JSONSchemaNumber | JSONSchemaString | JSONSchemaBoolean | JSONSchemaArray | JSONSchemaObject;

export type FromSchema<T> = T extends {type: 'number'}
    ? number
    : T extends {type: 'string'}
    ? string
    : T extends {type: 'array'; items: infer P}
    ? FromSchema<P>[]
    : T extends {type: 'object'; properties: infer P}
    ? {[K in keyof P]: FromSchema<P[K]>}
    : never;

export type FromObjectSchema<T extends Record<string, JSONSchema>> = {[K in keyof T]: FromSchema<T[K]>};
