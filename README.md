
This is a simple script that will copy a given input and recursively inject GraphQL \_\_typenames.

## Usage

```typescript
import addTypenames from 'add-typenames';
import { buildSchema } from 'graphql'

const typeDefs = `
    """ Add your schema definition here
`;

const schema = buildSchema(typeDefs);

const typedItem = addTypenames({ item, schema });
```

### Handling Unions, Interfaces and Scalars
In order to properly resolve Unions, Interfaces and Scalars we need the resolvers for those types to be included as part of the schema.
This can be done with `makeExecutableSchema`

```typescript
import addTypenames from 'add-typenames';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

const typedItem = addTypenames({ item, schema });
```
