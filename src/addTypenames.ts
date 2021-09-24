import * as _reduce from 'lodash/reduce';
import * as _map from 'lodash/map';
import * as _keys from 'lodash/keys';
import * as _filter from 'lodash/filter';
import {
    GraphQLSchema,
    GraphQLType,
    getNamedType,
    GraphQLNamedType,
    GraphQLField,
    isUnionType,
    isInterfaceType,
    GraphQLObjectType,
    isObjectType,
    isAbstractType,
    isInputObjectType,
    isScalarType,
    GraphQLScalarType,
} from 'graphql';

interface AddTypenamesProps {
    item: any;
    schema: GraphQLSchema;
    propertyOfParent?: string;
    parentTypeName?: string;
}

const isPromise = (possiblePromise: any): possiblePromise is Promise<unknown> =>
    typeof possiblePromise === 'object' && possiblePromise.then && typeof possiblePromise.then === 'function';

export const getCandidateTypes = ({ item, schema }: AddTypenamesProps) => {
    if (Array.isArray(item)) {
        throw new Error(`getCandidateTypes expects objects to be passed in not arrays!`);
    }
    if (!item || typeof item !== 'object' || item instanceof Date) {
        return [];
    }
    const typeMap = schema.getTypeMap();
    const fields = Object.keys(item).sort();
    const candidateTypes: GraphQLType[] = _filter(typeMap, possibleType => {
        if (isInputObjectType(possibleType)) {
            return false;
        }
        const config = possibleType.toConfig() as any;
        if (!config.astNode) {
            // Internal types do not have astNode set
            return false;
        }
        const doAllGivenFieldsExistInThePossibleType = config.fields && !fields.some(field => !config.fields[field]);
        return doAllGivenFieldsExistInThePossibleType;
    });

    return candidateTypes;
};

export const addTypenames = ({
    item,
    schema,
    propertyOfParent,
    parentTypeName,
}: AddTypenamesProps): Promise<any> => {
    if (Array.isArray(item)) {
        throw new Error(`addTypenames expects objects to be passed in not arrays!`);
    }
    if (item === null || item instanceof Date || typeof item !== 'object') {
        return item;
    }

    const newObject = { ...item };
    let namedType: GraphQLNamedType;

    if (item.__typename) {
        namedType = schema.getType(item.__typename)!;
    } else {
        if (parentTypeName) {
            if (!propertyOfParent) {
                throw new Error(`Expected a propertyOfParent to be given when parentTypeName is given!`);
            }
            const parentType = schema.getType(parentTypeName);
            if (!parentType) {
                throw new Error(`No parent type found for the typename ${parentTypeName}`);
            }

            if (!isObjectType(parentType)) {
                throw new Error(`Parent type ${parentTypeName} is expected to be an object type but it not`);
            }

            const field = parentType.getFields()[propertyOfParent];
            if (!field) {
                throw new Error(`The given field (${propertyOfParent}) does not exist on type ${parentType.name}`);
            }
            namedType = getNamedType(field.type);
        } else if (propertyOfParent) {
            throw new Error(`Expected a parentTypeName to be given when propertyOfParent is given!`);
        } else {
            const errorHint = `

This is the relevant object given\n${JSON.stringify(item, null, '\t')}

Hint: Try adding a __typename on your initial input object or pass in a propertyOfParent & parentTypeName.
`;
            const candidateTypes = getCandidateTypes({ item, schema });
            if (candidateTypes.length === 0) {
                // TODO find candidates based on most number of matching fields
                throw new Error(`No viable typenames found!${errorHint}`);
            } else if (candidateTypes.length === 1) {
                namedType = getNamedType(candidateTypes[0]);
            } else {
                // TODO filter down the list
                // a) Check the types of each field
                // b) Resolve unions
                throw new Error(`Cannot resolve the __typename between these possible types!

    ${_map(candidateTypes, candidateType => candidateType.inspect()).join('\n\t')}
${errorHint}`);
            }
        }
    }

    let type: GraphQLObjectType | GraphQLScalarType;
    if (isObjectType(namedType)) {
        type = namedType;
    } else if (isScalarType(namedType)) {
        return item;
    } else {
        if (isAbstractType(namedType)) {
            if (!namedType.resolveType) {
                // TODO inspect the options using the same field matching logic as is found in getCandidateTypes
                throw new Error(`No resolveType found for the interface ${namedType.name}`);
            }
            const typename = namedType.resolveType(item, null, {} as any, namedType);
            if (!typename) {
                throw new Error(`Unable to resolve type for abstract type ${namedType.name}`);
            }
            if (isPromise(typename)) {
                throw new Error(
                    `The resolveType for ${namedType.name} returns a promise but only synchronous resolvers are supported!`,
                );
            }
            if (isObjectType(typename)) {
                type = typename;
            } else {
                const resolvedType = schema.getType(typename);
                if (!resolvedType || !isObjectType(resolvedType)) {
                    throw new Error(
                        `The abstract type ${namedType.name} resolved to an unknown or misconfigured type ${typename}`,
                    );
                }
                type = resolvedType;
            }
        } else {
            throw new Error(
                `Unexpected type found ${namedType.name}! propertyOfParent : ${propertyOfParent}, parentTypeName: ${parentTypeName}`,
            );
        }
    }

    return _reduce(
        _keys(item),
        (newObj, propertyName) => {
            const child = item[propertyName];
            if (Array.isArray(child)) {
                newObj[propertyName] = _map(child, currentChild =>
                    addTypenames({
                        item: currentChild,
                        schema,
                        propertyOfParent: propertyName,
                        parentTypeName: type.name,
                    }),
                );
            } else {
                newObj[propertyName] = addTypenames({
                    item: child,
                    schema,
                    propertyOfParent: propertyName,
                    parentTypeName: type.name,
                });
            }
            return newObj;
        },
        {
            __typename: type.name,
        } as any,
    );
};
