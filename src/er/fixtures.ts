export interface ErFixture {
  slug: string;
  name: string;
  source: string;
}

export const erFixtures: ErFixture[] = [
  {
    slug: 'commerce',
    name: 'Commerce entities and attributes',
    source: `@startuml
title Commerce model
entity Customer {
  * customer_id : INT <<PK>>
  name : VARCHAR
  email : VARCHAR <<UK>>
}
entity Order {
  * order_id : INT <<PK>>
  customer_id : INT <<FK>>
  placed_at : TIMESTAMP
}
Customer ||--o{ Order : places
@enduml`,
  },
  {
    slug: 'aliases-cardinalities',
    name: 'Aliases and cardinalities',
    source: `@startuml
entity "Library Member" as Member
entity Book
Member ||--o{ Book : borrows
Book }o--|| Member : returned by
@enduml`,
  },
  {
    slug: 'enum-self',
    name: 'Enumeration and self relationship',
    source: `@startuml
enum Status {
  OPEN
  PAID
}
entity Employee {
  * id : INT <<PK>>
  manager_id : INT <<FK>>
}
Employee ||--o{ Employee : manages
@enduml`,
  },
  {
    slug: 'recovery',
    name: 'Tolerant recovery',
    source: `@startuml
entity Broken {
  * id : INT <<PK>>
@enduml`,
  },
];
