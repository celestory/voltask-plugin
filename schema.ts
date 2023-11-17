export type JSONSchema =
    | {type: 'number'; default?: number}
    | {type: 'string'; default?: string}
    | {type: 'boolean'; default?: boolean}
    | {type: 'object'; required?: readonly string[]; properties: Record<string, JSONSchema>; additionalProperties: boolean}
    | {
          type: 'array';
          title?: string;
          default?: unknown[];
          items?: JSONSchema;
          prefixItems?: JSONSchema[];
          minItems?: number;
          maxItems?: number;
          uniqueItems?: boolean;
      };

export type FromSchema<T> = T extends {type: 'number'}
    ? number
    : T extends {type: 'string'}
    ? string
    : T extends {type: 'object'; properties: infer P}
    ? {[K in keyof P]: FromSchema<P[K]>}
    : never;
