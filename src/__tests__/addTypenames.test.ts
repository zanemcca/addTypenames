import { GraphQLSchema, buildSchema } from 'graphql';
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars';
import { makeExecutableSchema } from '@graphql-tools/schema';
import _map from 'lodash/map';
import { readFileSync } from 'fs';

import { addTypenames } from '../addTypenames';

describe('addTypenames', () => {
    let schema: GraphQLSchema;
    let resolvers: any;
    let data: any;
    let typeDefs: string;
    beforeEach(() => {
        typeDefs = readFileSync(`${__dirname}/graphql.test.gql`, 'utf8');
        data = {
            chicken: {
                id: 1,
                name: 'Henrieta',
                cost: 45,
                feedRequirements: 45,
                eggOutput: 30,
            },
            cow: {
                id: 2,
                name: 'Moophy',
                cost: 1200,
                hayRequirements: 200,
                milkOutput: 500,
            },
            tractor: {
                id: 1,
                brand: 'John Deer',
                type: 'Tractor',
                purchasedOn: new Date(),
            },
            house: {
                id: 1,
                description: 'The house',
                cost: 400000,
            },
            barn: {
                id: 2,
                description: 'Barn',
                cost: 100000,
            },
        };
        resolvers = {
            DateTime: DateTimeResolver,
            JSONObject: JSONObjectResolver,
            Animal: {
                __resolveType: (animal: any) => {
                    if (animal.hayRequirements || animal.milkOutput) {
                        return 'Cow';
                    }
                    if (animal.eggOutput || animal.feedRequirements) {
                        return 'Chicken';
                    }
                    return null;
                },
            },
            Asset: {
                __resolveType: (asset: any) => {
                    if (asset.brand) {
                        return 'Equipment';
                    }
                    if (asset.description) {
                        return 'Building';
                    }
                    return null;
                },
            },
        };
        schema = makeExecutableSchema({
            typeDefs,
            resolvers,
        });
    });

    describe('trivial cases', () => {
        it('should return a string unmodified', () => {
            const input = 'hello world';
            expect(addTypenames({ item: input, schema })).toBe(input);
        });
        it('should return an int unmodified', () => {
            const input = 1234;
            expect(addTypenames({ item: input, schema })).toBe(input);
        });
        it('should return an float unmodified', () => {
            const input = 1234.567;
            expect(addTypenames({ item: input, schema })).toBe(input);
        });
    });

    it('should find the typenames of the children', async () => {
        const input = {
            __typename: 'Farm',
            buildings: [data.house, data.barn],
            equipment: [data.tractor],
        };
        const result = addTypenames({ item: input, schema });
        expect(result).toMatchObject({
            ...input,
            buildings: _map(input.buildings, building => ({
                ...building,
                __typename: 'Building',
            })),
            equipment: _map(input.equipment, equipment => ({
                ...equipment,
                __typename: 'Equipment',
            })),
        });
    });

    it('should resolve scalars', async () => {
        const input = {
            __typename: 'Farm',
            equipment: [
                {
                    ...data.tractor,
                    info: {
                        notes: 'Some notes',
                        vin: '123abc456',
                    },
                },
            ],
        };
        const result = addTypenames({ item: input, schema });
        expect(result).toMatchObject({
            ...input,
            equipment: _map(input.equipment, equipment => ({
                ...equipment,
                __typename: 'Equipment',
            })),
        });
    });

    it('should resolve interfaces', async () => {
        const input = {
            __typename: 'Farm',
            animals: [data.chicken, data.cow],
        };
        const result = addTypenames({ item: input, schema });
        expect(result).toMatchObject({
            ...input,
            animals: [
                {
                    ...data.chicken,
                    __typename: 'Chicken',
                },
                {
                    ...data.cow,
                    __typename: 'Cow',
                },
            ],
        });
    });

    it('should resolve unions', async () => {
        const input = {
            __typename: 'Farm',
            assets: [data.house, data.tractor, data.barn],
        };
        const result = addTypenames({ item: input, schema });
        expect(result).toMatchObject({
            ...input,
            assets: [
                {
                    ...data.house,
                    __typename: 'Building',
                },
                {
                    ...data.tractor,
                    __typename: 'Equipment',
                },
                {
                    ...data.barn,
                    __typename: 'Building',
                },
            ],
        });
    });

    describe('advanced usage', () => {
        describe('using propertyOfParent and parentTypeName', () => {
            it('should use the parentTypeName & propertyOfParent fields to resolve the ambiguous input', () => {
                const input = {
                    id: data.barn.id,
                };
                const result = addTypenames({
                    item: input,
                    schema,
                    parentTypeName: 'Farm',
                    propertyOfParent: 'equipment',
                });
                expect(result).toMatchObject({
                    ...input,
                    __typename: 'Equipment',
                });
            });

            describe('errors', () => {
                it('should complain about the propertyOfParent field being missing', () => {
                    const input = {
                        id: data.barn.id,
                    };
                    expect(() =>
                        addTypenames({ item: input, schema, parentTypeName: 'Farm' }),
                    ).toThrowErrorMatchingSnapshot();
                });
                it('should complain about the parentTypeName field being missing', () => {
                    const input = {
                        id: data.barn.id,
                    };
                    expect(() =>
                        addTypenames({ item: input, schema, propertyOfParent: 'equipment' }),
                    ).toThrowErrorMatchingSnapshot();
                });
            });
        });
    });

    describe('heuristic approach using getCandidateTypes', () => {
        it('should find the typename for a plain object when there is no ambiguity', async () => {
            const input = {
                id: 5,
                brand: 'International',
                type: 'Tractor',
            };
            const result = addTypenames({ item: input, schema });
            expect(result).toHaveProperty('__typename', 'Equipment');
        });

        describe('errors', () => {
            it('should complain about there being too many possible typename matches', async () => {
                const input = {
                    id: data.chicken.id,
                    name: data.chicken.name,
                };
                expect(() => addTypenames({ item: input, schema })).toThrowErrorMatchingSnapshot();
            });

            it('should complain about there being no typename matches', async () => {
                const input = {
                    ...data.chicken,
                    notAField: 'this is just some extra field that does not exist in the model',
                };
                expect(() => addTypenames({ item: input, schema })).toThrowErrorMatchingSnapshot();
            });
        });
    });

    describe('errors', () => {
        describe('async resolvers', () => {
            beforeEach(() => {
                const oldAnimalResolver = resolvers.Animal.__resolveType;
                resolvers = {
                    ...resolvers,
                    Animal: {
                        __resolveType: async (animal: any) => oldAnimalResolver(animal),
                    },
                };
                schema = makeExecutableSchema({
                    typeDefs,
                    resolvers,
                });
            });

            it('should complain about the Animal resolver using Promises', async () => {
                const input = {
                    __typename: 'Farm',
                    animals: [data.chicken],
                };
                expect(() => addTypenames({ item: input, schema })).toThrowErrorMatchingSnapshot();
            });
        });

        describe('missing resolvers', () => {
            beforeEach(() => {
                const oldAnimalResolver = resolvers.Animal.__resolveType;
                resolvers = {
                    ...resolvers,
                    Animal: {},
                };
                schema = makeExecutableSchema({
                    typeDefs,
                    resolvers,
                });
            });

            it('should complain about the Animal resolver not being present', async () => {
                const input = {
                    __typename: 'Farm',
                    animals: [data.chicken],
                };
                expect(() => addTypenames({ item: input, schema })).toThrowErrorMatchingSnapshot();
            });
        });
    });
});
