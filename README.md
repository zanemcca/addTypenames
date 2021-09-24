# add-typenames

`addTypenames` copies a given input object and recursively adds GraphQL `__typenames` to the output.

### Installation
`yarn install add-typenames graphql`

### Usage
`const typedItem = addTypenames({ item, schema });`

#### Example
```typescript
import addTypenames from 'add-typenames';
import { buildSchema } from 'graphql'

const typeDefs = `
    """ Add your schema definition here
`;
const item = {
    /* Your item to be typed */
};

const schema = buildSchema(typeDefs);

const typedItem = addTypenames({ item, schema });
```


> Hint: Adding `__typename` to the root of the input item will resolve most issues that may arise by leveraging the schema to resolve all types rather than relying on heuristics

#### Handling Unions, Interfaces and Scalars
In order to properly resolve Unions, Interfaces and Scalars we need the resolvers for those types to be included as part of the schema.
This can be done with `makeExecutableSchema`

```typescript
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});
```
> Hint: Only include the resolvers for Unions, Interfaces and Scalars. The rest are unused and not needed.
