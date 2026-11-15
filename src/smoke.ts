import { writeFileSync } from 'node:fs';
import { parse } from './parser/parse.ts';
import { layout } from './layout.ts';
import { renderSvg } from './render.ts';
import { classic } from './theme.ts';
import { estimateMeasure } from './measure.ts';
const src = `@startuml
title Order flow
header Draft
autonumber
box "Backend" #lightblue
participant "Order Service" as OS
database DB
end box
actor Customer
queue MQ
Customer -> OS ++ : place order\\n(2 items)
OS -> DB ++ : INSERT
DB --> OS -- : ok
== Payment ==
alt paid
  OS ->> MQ : publish
  note over OS, MQ : fan-out
else declined
  OS -[#red]>x Customer : failed
end
loop 3 times
  OS -> OS : retry
end
... 5 minutes later ...
[-> OS : webhook
create Mailer
OS -> Mailer ** : send
return done
|||
OS -> Customer !! : bye
@enduml`;
const d = parse(src), th = classic;
const sc = layout(d, th, estimateMeasure(th.font.size));
console.log('warnings', d.warnings, sc.warnings, 'viewBox', sc.viewBox, 'shapes', sc.shapes.length);
writeFileSync('/tmp/out.svg', renderSvg(sc, th));
