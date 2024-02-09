// deno-lint-ignore-file no-explicit-any
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
    properties?: Record<string, JSONSchema>;
    additionalProperties?: boolean | JSONSchema;
} & JSONSchemaShared<object>;

export type JSONSchema = JSONSchemaAny | JSONSchemaNumber | JSONSchemaString | JSONSchemaBoolean | JSONSchemaArray | JSONSchemaObject;

type PT = {__phantomType: symbol};
type NoPT<T> = T extends PT ? never : T;

// type Or2<T1, T2> = T1 extends PT ? T2 : T1;
type Or3<T1, T2, T3> = T1 extends PT ? (T2 extends PT ? T3 : T2) : T1;
type Or4<T1, T2, T3, T4> = T1 extends PT ? (T2 extends PT ? (T3 extends PT ? T4 : T3) : T2) : T1;
type Or5<T1, T2, T3, T4, T5> = T1 extends PT ? (T2 extends PT ? (T3 extends PT ? (T4 extends PT ? T5 : T4) : T3) : T2) : T1;

type VT_Any<T extends JSONSchema> = T extends {type: unknown} ? (T['type'] extends undefined ? any : PT) : any;

type VT_Const<T extends JSONSchema> = T extends {const: infer U} ? U : PT;

type VT_Scalar<T extends JSONSchema> = Or3<VT_Scalar_Number<T>, VT_Scalar_String<T>, VT_Scalar_Boolean<T>>;
type VT_Scalar_Number<T extends JSONSchema> = T extends {type: 'number'} ? number : PT;
type VT_Scalar_String<T extends JSONSchema> = T extends {type: 'string'} ? string : PT;
type VT_Scalar_Boolean<T extends JSONSchema> = T extends {type: 'boolean'} ? boolean : PT;

type VT_Array<T extends JSONSchema> = Or3<VT_Array_Empty<T>, VT_Array_Tuple<T>, VT_Array_Mapped<T>>;
type VT_Array_Empty<T extends JSONSchema> = T extends {type: 'array', items?: undefined, prefixItems?: undefined} ? any[] : PT;
type VT_Array_Tuple<T extends JSONSchema> = T extends {type: 'array', items?: undefined | JSONSchema, prefixItems: infer PI extends JSONSchema[]} ? {[K in keyof PI]: FromSchema<PI[K]>} : PT;
type VT_Array_Mapped<T extends JSONSchema> = T extends {type: 'array', items: JSONSchema, prefixItems?: undefined} ? FromSchema<T['items']>[] : PT;

type VT_Object<T extends JSONSchema> = Or4<VT_Object_Empty<T>, VT_Object_Mapped<T>, VT_Object_Record<T>, VT_Object_Record_Mapped<T>>;
type VT_Object_Empty<T extends JSONSchema> = T extends {type: 'object', properties?: undefined, additionalProperties?: false} ? {[K: string]: any} : PT;
type VT_Object_Mapped<T extends JSONSchema> = T extends {type: 'object', properties: infer P extends Record<string, JSONSchema>, additionalProperties?: false} ? {[K in keyof P]: FromSchema<P[K]>} : PT;
type VT_Object_Record<T extends JSONSchema> = T extends {type: 'object', properties?: undefined, additionalProperties: infer AP extends JSONSchema} ? Record<string, FromSchema<AP>> : PT;
type VT_Object_Record_Mapped<T extends JSONSchema> = T extends {type: 'object', properties: infer P extends Record<string, JSONSchema>, additionalProperties: infer AP extends JSONSchema} ? {[K in keyof P]: FromSchema<P[K]>} & {[K: string]: FromSchema<AP>} : PT;

export type FromSchema<T extends JSONSchema> = NoPT<Or5<VT_Any<T>, VT_Const<T>, VT_Scalar<T>, VT_Array<T>, VT_Object<T>>>;
export type FromObjectSchema<T extends Record<string, JSONSchema>> = {[K in keyof T]: FromSchema<T[K]>};
