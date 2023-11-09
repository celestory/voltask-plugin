export type JSONSchema =
    | {type: 'number'; default?: number}
    | {type: 'string'; default?: string}
    | {type: 'boolean'; default?: boolean}
    | {type: 'object'; required?: readonly string[]; properties: Record<string, JSONSchema>; additionalProperties: boolean};

export type FromSchema<T> = T extends {type: 'number'}
    ? number
    : T extends {type: 'string'}
    ? string
    : T extends {type: 'object'; properties: infer P}
    ? {[K in keyof P]: FromSchema<P[K]>}
    : never;
