export interface Fixture {
  slug: string;
  name: string;
  source: string;
}

const uml = (body: string) => `@startuml\n${body}\n@enduml`;

export const fixtures: Fixture[] = [
  {
    slug: 'basic-messages',
    name: 'Basic messages',
    source: uml(`participant Client
participant Server
Client -> Server : request
Server --> Client : response`),
  },
  {
    slug: 'participant-kinds',
    name: 'Participant kinds',
    source: uml(`actor User
boundary UI
control Controller
entity Model
database DB
collections Replicas
queue Jobs
participant Service
User -> UI : use
UI -> Controller : dispatch
Controller -> Model : read
Controller -> DB : query
Controller -> Replicas : update
Controller -> Jobs : enqueue
Controller -> Service : call`),
  },
  {
    slug: 'aliases-and-labels',
    name: 'Aliases and labels',
    source: uml(`participant "Identity Provider" as IdP
participant API as "Public API"
actor "End User" as EU
EU -> API : authenticate
API -> IdP : verify token
IdP --> API : claims`),
  },
  {
    slug: 'participant-order',
    name: 'Participant order',
    source: uml(`participant Third order 30
participant First order 10
participant Second order 20
First -> Second : one
Second -> Third : two`),
  },
  {
    slug: 'participant-colors',
    name: 'Participant colors',
    source: uml(`participant Alpha #lightblue
participant Beta #FFE0B2
actor Gamma #pink
Alpha -> Beta : ping
Beta -> Gamma : notify`),
  },
  {
    slug: 'participant-boxes',
    name: 'Participant boxes',
    source: uml(`box "Client tier" #lightblue
actor User
boundary Browser
end box
box "Services" #FFE0B2
participant API
database DB
end box
User -> Browser : open
Browser -> API : fetch
API -> DB : select`),
  },
  {
    slug: 'message-arrowheads',
    name: 'Message arrowheads',
    source: uml(`A -> B : filled
A ->> B : open
A -\ B : half filled
A -/ B : half filled slash
A ->x B : lost
A ->o B : circle`),
  },
  {
    slug: 'reversed-bidirectional',
    name: 'Reversed and bidirectional arrows',
    source: uml(`A <- B : reversed
A <-> B : both ends
A <-- B : reversed dashed
A <--> B : both dashed`),
  },
  {
    slug: 'colored-dashed-arrows',
    name: 'Colored and dashed arrows',
    source: uml(`A -[#red]> B : red
A -[#0000FF]-> B : blue
A -[dashed]> B : dashed style
A -[dotted,#green]> B : dotted style`),
  },
  {
    slug: 'edge-messages',
    name: 'Found and lost messages',
    source: uml(`participant A
participant B
[-> A : found on left
A ->] : lost on right
[-> B : another arrival`),
  },
  {
    slug: 'self-message',
    name: 'Self messages',
    source: uml(`participant Worker
Worker -> Worker : initialize
Worker -> Worker : process queue
Worker --> Worker : checkpoint`),
  },
  {
    slug: 'multiline-labels',
    name: 'Multiline labels',
    source: uml(`participant "Order Service" as Orders
participant "Payment Service" as Payments
Orders -> Payments : authorize customer\nand reserve funds
Payments --> Orders : approved\nreference 12345`),
  },
  {
    slug: 'activation-shorthand',
    name: 'Activation shorthand',
    source: uml(`A -> B ++ : activate
B -> C ++ : nested call
C --> B -- : finish C
B --> A -- : finish B`),
  },
  {
    slug: 'explicit-activation',
    name: 'Explicit activation',
    source: uml(`A -> B : call
activate B
B -> C : delegate
activate C
C --> B : result
deactivate C
B --> A : result
deactivate B`),
  },
  {
    slug: 'nested-activation',
    name: 'Nested activation bars',
    source: uml(`A -> B ++ : outer
B -> B ++ : inner
B --> B -- : inner done
B --> A -- : outer done`),
  },
  {
    slug: 'return-stack',
    name: 'Return call stack',
    source: uml(`A -> B ++ : first
B -> C ++ : second
C -> D ++ : third
return D result
return C result
return B result`),
  },
  {
    slug: 'create-participant',
    name: 'Created participant',
    source: uml(`participant Factory
create participant Worker
Factory -> Worker ** : create
Factory -> Worker : assign job
Worker --> Factory : ready`),
  },
  {
    slug: 'destroy-participant',
    name: 'Destroyed participant',
    source: uml(`participant Manager
participant Worker
Manager -> Worker ++ : start
Manager -> Worker !! : stop
Manager -> Manager : continue`),
  },
  {
    slug: 'note-positions',
    name: 'Note positions',
    source: uml(`participant A
participant B
participant C
note left of A : left note
note over B : over one
note right of C : right note
A -> B : message
note over A, C : over several`),
  },
  {
    slug: 'multiline-notes',
    name: 'Multiline notes',
    source: uml(`participant A
participant B
note left of A
First line
Second line
end note
A -> B : work
note over A, B
Shared context
across two lines
end note`),
  },
  {
    slug: 'note-shapes-colors',
    name: 'Note shapes and colors',
    source: uml(`participant A
participant B
note right of A #pink : standard
hnote over B #lightblue : hexagonal
rnote over A, B #FFE0B2 : rectangular`),
  },
  {
    slug: 'note-across',
    name: 'Note across diagram',
    source: uml(`participant A
participant B
participant C
note across : applies to the whole diagram
A -> C : message`),
  },
  {
    slug: 'reference-fragment',
    name: 'Reference fragment',
    source: uml(`participant Web
participant Auth
Web -> Auth : login
ref over Web, Auth : see authentication flow
Auth --> Web : session`),
  },
  {
    slug: 'alt-else',
    name: 'Alternative branches',
    source: uml(`participant App
participant Cache
App -> Cache : lookup
alt cache hit
  Cache --> App : cached value
else cache miss
  App -> Cache : load value
  Cache --> App : fresh value
end`),
  },
  {
    slug: 'opt-fragment',
    name: 'Optional fragment',
    source: uml(`participant Client
participant Metrics
Client -> Client : handle request
opt metrics enabled
  Client -> Metrics : record latency
end`),
  },
  {
    slug: 'loop-fragment',
    name: 'Loop fragment',
    source: uml(`participant Poller
participant API
loop every 30 seconds
  Poller -> API : health check
  API --> Poller : healthy
end`),
  },
  {
    slug: 'parallel-fragment',
    name: 'Parallel sections',
    source: uml(`participant Coordinator
participant Alpha
participant Beta
par first task
  Coordinator -> Alpha : run
else second task
  Coordinator -> Beta : run
end`),
  },
  {
    slug: 'break-critical',
    name: 'Break and critical fragments',
    source: uml(`participant App
participant DB
critical transaction
  App -> DB : update
  break validation failed
    DB --> App : rollback
  end
end`),
  },
  {
    slug: 'nested-fragments',
    name: 'Nested fragments',
    source: uml(`participant A
participant B
alt connected
  loop up to 3 attempts
    A -> B : ping
    opt diagnostic mode
      B --> A : diagnostics
    end
  end
else offline
  A -> A : queue locally
end`),
  },
  {
    slug: 'group-fragment',
    name: 'Group fragment',
    source: uml(`participant UI
participant Service
group initialization
  UI -> Service : configure
  Service --> UI : ready
end`),
  },
  {
    slug: 'divider-delay-spacing',
    name: 'Dividers, delays, and spacing',
    source: uml(`A -> B : before
== Second phase ==
A -> B : after
... a few minutes later ...
B --> A : resumed
|||
A -> B : default gap
||60||
B -> A : explicit gap`),
  },
  {
    slug: 'document-text',
    name: 'Title, header, and footer',
    source: uml(`title Order processing\nsequence overview
header Internal design
footer Generated locally
participant Web
participant Orders
Web -> Orders : submit`),
  },
  {
    slug: 'multiline-document-text',
    name: 'Multiline document text',
    source: uml(`title
Checkout flow
with inventory reservation
end title
header
Architecture group
end header
footer
Draft for review
end footer
A -> B : checkout`),
  },
  {
    slug: 'autonumber-basic',
    name: 'Basic autonumbering',
    source: uml(`autonumber
A -> B : one
B -> C : two
C --> A : three`),
  },
  {
    slug: 'autonumber-format',
    name: 'Formatted autonumbering',
    source: uml(`autonumber 10 5 "<b>[000]"
A -> B : ten
B -> C : fifteen
C --> A : twenty`),
  },
  {
    slug: 'autonumber-stop-resume',
    name: 'Stop and resume autonumbering',
    source: uml(`autonumber 1 2
A -> B : numbered
autonumber stop
B -> C : unnumbered
autonumber resume 3
C -> A : numbered again`),
  },
  {
    slug: 'hide-footbox',
    name: 'Hidden footboxes',
    source: uml(`hide footbox
actor User
participant App
User -> App : action
App --> User : result`),
  },
  {
    slug: 'skinparam-colors',
    name: 'Color skinparams',
    source: uml(`skinparam backgroundcolor #FAFAFA
skinparam sequence {
ArrowColor #224477
LifeLineBorderColor #888888
ParticipantBackgroundColor #E3F2FD
ParticipantBorderColor #1565C0
NoteBackgroundColor #FFF9C4
NoteBorderColor #F9A825
}
participant A
participant B
A -> B : styled
note over B : themed note`),
  },
  {
    slug: 'skinparam-font',
    name: 'Font skinparams',
    source: uml(`skinparam defaultFontName Liberation Sans
skinparam defaultFontSize 15
participant A
participant B
A -> B : larger text`),
  },
  {
    slug: 'comments',
    name: 'Comments',
    source: uml(`' single-line comment
/' block
comment across lines
'/
participant A
participant B
A -> B : visible`),
  },
  {
    slug: 'tolerant-unsupported',
    name: 'Tolerates unsupported syntax',
    source: uml(`!include styles.puml
participant A
participant B
A -> B : retained
newpage optional title
B --> A : also retained`),
  },
  {
    slug: 'unclosed-fragment',
    name: 'Unclosed fragment recovery',
    source: `@startuml\nparticipant A\nparticipant B\nalt recoverable\nA -> B : still rendered`,
  },
  {
    slug: 'unclosed-note',
    name: 'Unclosed note recovery',
    source: `@startuml\nparticipant A\nnote right of A\nfirst line\nsecond line`,
  },
  {
    slug: 'created-in-fragment',
    name: 'Creation inside fragment',
    source: uml(`participant Factory
opt worker required
  create participant Worker
  Factory -> Worker ** : construct
  Factory -> Worker : configure
end`),
  },
  {
    slug: 'activation-colors',
    name: 'Activation colors',
    source: uml(`A -> B ++ #lightblue : blue bar
B -> C ++ #FFE0B2 : orange bar
C --> B -- : finish
B --> A -- : finish`),
  },
  {
    slug: 'long-label-spacing',
    name: 'Long-label column spacing',
    source: uml(`participant A
participant B
participant C
A -> C : a particularly long message that must span two column gaps
B -> B : a long self-message label that needs its own horizontal space
C -> A : done`),
  },
  {
    slug: 'note-column-spacing',
    name: 'Note-driven column spacing',
    source: uml(`participant A
participant B
participant C
note left of A : a wide note on the left changes the first gap
note over B, C : a wide shared note changes the final gap
A -> C : message`),
  },
  {
    slug: 'empty-label-autonumber',
    name: 'Empty labels with autonumbering',
    source: uml(`autonumber
A -> B
B -> C :
C --> A : result`),
  },
  {
    slug: 'without-start-directives',
    name: 'Input without start directives',
    source: `participant A\nparticipant B\nA -> B : works without wrappers\nB --> A : response`,
  },
  {
    slug: 'realistic-login',
    name: 'Realistic login flow',
    source: uml(`title Login with cached credentials
autonumber
actor User
boundary Browser
control Auth
database Sessions
User -> Browser : submit credentials
Browser -> Auth ++ : login
Auth -> Sessions ++ : find session
alt valid session
  Sessions --> Auth : session data
  Auth --> Browser : authenticated
else missing or expired
  Sessions --> Auth : no session
  Auth -> Auth : validate password
  opt remember me
    Auth -> Sessions : create persistent session
  end
  Auth --> Browser : new session
end
deactivate Sessions
deactivate Auth
Browser --> User : redirect home
note right of Auth : all credentials stay local`),
  },
  {
    slug: 'realistic-order',
    name: 'Realistic order flow',
    source: uml(`title Place an order
autonumber "<b>Step 0"
box "Customer tier" #lightblue
actor Customer
boundary Storefront
end box
box "Backend" #FFE0B2
control Orders
database Inventory
queue Events
end box
Customer -> Storefront : checkout
Storefront -> Orders ++ : submit order
Orders -> Inventory ++ : reserve items
alt all items available
  Inventory --> Orders : reservation
  Orders -> Events : publish OrderPlaced
  par notifications
    Orders -> Storefront : confirmation
  else analytics
    Orders -> Events : publish Metrics
  end
else insufficient stock
  Inventory --> Orders : unavailable items
  break cannot fulfill
    Orders --> Storefront : rejection
  end
end
deactivate Inventory
return order result
... confirmation email arrives later ...
[-> Events : deliver receipt
note over Orders, Events : consumers retry safely`),
  },
  {
    slug: 'creole-inline-markup',
    name: 'Creole inline markup',
    source: uml(`title A **bold** and //italic// title
participant "**Bold User**" as User
participant App
User -> App : **bold** and //italic// and <color:red>red text</color>
note over User, App : **nested //bold italic// text** and <color:#0000FF>blue</color>
App --> User : <color:#008000>escaped <&> text</color>`),
  },
  {
    slug: 'parallel-messages',
    name: 'Parallel messages',
    source: uml(`participant A
participant B
participant C
A -> B : first
& B -> C : second
& C -> A : third
A -> B : normal spacing`),
  },
  {
    slug: 'multiple-pages',
    name: 'Multiple pages',
    source: uml(`title First page
participant A
participant B
A -> B : page one
newpage Second page
A -> B : page two`),
  },
  {
    slug: 'multiline-reference',
    name: 'Multiline reference',
    source: uml(`participant Web
participant Auth
ref over Web, Auth
See the **authentication** flow
for //token renewal// details
end ref
Web -> Auth : renew`),
  },
];
