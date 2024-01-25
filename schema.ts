// eslint-disable-next-line @typescript-eslint/ban-types

export type JSONSchemaShared<T> = {
    const?: T;
    title?: string;
    format?: string;
    default?: T;
    errorMessage?: string | object;
};

export type JSONSchemaAny = {
    type?: never;
    const?: never;
} & JSONSchemaShared<unknown>;

export type JSONSchemaNumber = {
    type: 'number';
} & JSONSchemaShared<number>;

export type JSONSchemaString = {
    type: 'string';
    enum?: string[];
} & JSONSchemaShared<string>;

export type JSONSchemaBoolean = {
    type: 'boolean';
} & JSONSchemaShared<boolean>;

export type JSONSchemaArray = {
    type: 'array';
    items?: JSONSchema;
    minItems?: number;
    maxItems?: number;
    prefixItems?: JSONSchema[];
    uniqueItems?: boolean;
} & JSONSchemaShared<unknown[]>;

export type JSONSchemaObject = {
    type: 'object';
    required?: readonly string[];
    properties: Record<string, JSONSchema>;
    additionalProperties?: boolean;
} & JSONSchemaShared<object>;

export type JSONSchema = JSONSchemaAny | JSONSchemaNumber | JSONSchemaString | JSONSchemaBoolean | JSONSchemaArray | JSONSchemaObject;

export type FromSchema<T> = T extends {type: 'number'}
    ? number
    : T extends {type: 'boolean'}
    ? boolean
    : T extends {type: 'string'}
    ? string
    : T extends {type: 'array'; items: infer P; minItems?: number; uniqueItems?: boolean}
    ? FromSchema<P>[]
    : T extends {type: 'object'; properties: infer P}
    ? {[K in keyof P]: FromSchema<P[K]>}
    : never;

export type FromObjectSchema<T extends Record<string, JSONSchema>> = {[K in keyof T]: FromSchema<T[K]>};
