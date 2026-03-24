/**
 * Seed: Acto 1 — Los temores de los leñadores (misión principal)
 *
 * Usage:
 *   CAMPAIGN_NAME="El Último Eco de la Forja" npx ts-node prisma/seeds/acto1-lenadores.ts
 *   or set CAMPAIGN_ID directly.
 *
 * Safe to re-run: skips creation if decisions with the same mission already exist.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CAMPAIGN_NAME = process.env.CAMPAIGN_NAME ?? 'El Último Eco de la Forja'
const CAMPAIGN_ID   = process.env.CAMPAIGN_ID   ?? null

async function main() {
  // ── 1. Resolve campaign ───────────────────────────────────────────────────
  const campaign = CAMPAIGN_ID
    ? await prisma.campaign.findUniqueOrThrow({ where: { id: CAMPAIGN_ID } })
    : await prisma.campaign.findFirstOrThrow({ where: { name: { contains: CAMPAIGN_NAME } } })

  console.log(`Campaign: ${campaign.name} (${campaign.id})`)

  // ── 2. Upsert chapter ─────────────────────────────────────────────────────
  let chapter = await prisma.chapter.findFirst({
    where: { campaignId: campaign.id, name: { contains: 'Acto 1' } },
  })
  if (!chapter) {
    chapter = await prisma.chapter.create({
      data: {
        campaignId: campaign.id,
        name: 'Acto 1 — Los Valles de Anduin',
        orderIndex: 1,
        status: 'pending',
      },
    })
    console.log(`Created chapter: ${chapter.name}`)
  } else {
    console.log(`Found chapter: ${chapter.name}`)
  }

  // ── 3. Upsert mission ─────────────────────────────────────────────────────
  let mission = await prisma.mission.findFirst({
    where: { campaignId: campaign.id, name: { contains: 'leñadores' } },
  })
  if (!mission) {
    mission = await prisma.mission.create({
      data: {
        campaignId: campaign.id,
        chapterId: chapter.id,
        name: 'Los temores de los leñadores',
        type: 'main',
        status: 'pending',
        orderIndex: 4,
        description:
          'Los árboles del Viejo Retazo se pudren desde dentro y algo susurra bajo la tierra. Harl Fotonegro, jefe leñador del valle, envía al grupo a investigar las ruinas hundidas de la colina partida, donde un fragmento rúnico caliente al tacto y un eco de espíritu atado revelan que el sello de Morladun está debilitándose.',
      },
    })
    console.log(`Created mission: ${mission.name}`)
  } else {
    console.log(`Found mission: ${mission.name}`)
  }

  // ── 4. Guard — skip if already seeded ─────────────────────────────────────
  const existing = await prisma.decision.count({
    where: { missionId: mission.id },
  })
  if (existing > 0) {
    console.log(`Mission already has ${existing} decision(s) — skipping seed.`)
    return
  }

  // ── 5. Create decisions + branches in a transaction ───────────────────────
  const result = await prisma.$transaction(async (tx) => {

    // D1 — Reunión con Harl: convencer para refuerzos
    const d1 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Intentan convencer a Harl de enviar leñadores como refuerzo?',
        context: 'Persuasión CD 13. Harl es reticente por miedo a exponer al poblado, pero respeta a quienes vienen enviados por Torgil.',
        orderIndex: 1,
        status: 'pending',
        positionX: 0,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Lo convencen (CD 13)',
              description: 'Harl envía 4 leñadores de escolta.',
              consequence: 'La exploración es menos solitaria. Posible intervención beornida si hay alarma visible.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Fallan o no lo intentan',
              description: 'Harl no envía ayuda — preocupado por exponer al poblado.',
              consequence: 'Sin escolta. El grupo va solo a las ruinas.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D2 — Investigar las runas del fragmento rúnico + leer a Harl
    const d2 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Examinan el fragmento rúnico y/o leen las intenciones de Harl?',
        context: 'Investigación/Historia CD 12 para reconocer lenguaje rúnico antiguo (indicio de sellado). Perspicacia CD 11 para notar que Harl protege a alguien (su sobrino enfermo).',
        orderIndex: 2,
        status: 'pending',
        positionX: 400,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'Examinan el fragmento con éxito (CD 12)',
              description: 'Reconocen trazas de lenguaje rúnico antiguo — indicio de un sellado.',
              consequence: 'Pista temprana sobre el sello de tres reliquias. Ventaja en comprender la cámara de la grieta.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Leen a Harl con éxito (Perspicacia CD 11)',
              description: 'Notan que Harl protege a alguien y explica su reticencia a llamar fuerza exterior.',
              consequence: 'Si se usa en conversación privada: Harl da información extra sobre el sitio exacto del fragmento y los síntomas del perro del campamento.',
              outcomeType: 'good',
              orderIndex: 1,
            },
            {
              label: 'No examinan o fallan ambas tiradas',
              description: 'Solo saben que "no es trabajo humano moderno".',
              consequence: 'Sin pistas adicionales. Harl cierra sus cartas.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D3 — ¿Qué hacen con el fragmento rúnico que muestra Harl?
    const d3 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Qué hacen con el fragmento rúnico que muestra Harl?',
        context: 'Harl tiene el fragmento envuelto en piel. Los PJ pueden examinarlo, pedirlo prestado, llevárselo o dejarlo con Harl.',
        orderIndex: 3,
        status: 'pending',
        positionX: 400,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Lo llevan consigo a las ruinas',
              description: 'El fragmento vibra y se calienta en el corredor hundido.',
              consequence: 'Activación del evento del eco en el corredor. Salvación SAB CD 10 para el portador.',
              outcomeType: 'variable',
              orderIndex: 0,
            },
            {
              label: 'Lo dejan con Harl para custodia',
              description: 'Harl lo guarda en un cofre rústico.',
              consequence: 'El poblado tiene noches inquietas (-1 moral 3 días). Sin riesgo para el grupo en las ruinas.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'No hacen nada con él',
              description: 'El fragmento permanece con Harl sin interacción especial.',
              consequence: 'Sin consecuencias adicionales.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D4 — Evento de viaje: arañas aplastadas / árbol hueco
    const d4 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Investigan las señales de corrupción durante el viaje?',
        context: 'Evento de viaje (1d20). Árbol hueco con interior negro (Naturaleza CD 10), susurros en las raíces (SAB CD 11: "…despertar…"), arañas petrificadas (Investigación CD 12: rastros de ruinas bajo el tronco).',
        orderIndex: 4,
        status: 'pending',
        positionX: 800,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'Investigan el árbol hueco (Naturaleza CD 10)',
              description: '"La corrupción empieza desde el corazón" — la podredumbre no es natural.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Escuchan los susurros de raíz (SAB CD 11)',
              description: 'Perciben el concepto "…despertar…" de la tierra.',
              outcomeType: 'good',
              orderIndex: 1,
            },
            {
              label: 'Examinan las arañas petrificadas (Investigación CD 12)',
              description: 'Identifican rastros de ruinas humanas antiguas bajo el tronco.',
              outcomeType: 'good',
              orderIndex: 2,
            },
            {
              label: 'Pasan sin investigar',
              description: 'Sin pistas adicionales del viaje.',
              outcomeType: 'neutral',
              orderIndex: 3,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D5 — Arañas desorientadas en la entrada de las ruinas
    const d5 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo manejan las arañas desorientadas en la entrada de las ruinas?',
        context: '3–6 arañas pequeñas desorientadas por la corrupción (HP 2, AC 12). No están corrompidas — solo asustadas. Atacan si se sienten acorraladas.',
        orderIndex: 5,
        status: 'pending',
        positionX: 800,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Las evitan o se mueven con cuidado',
              description: 'Las arañas no atacan si no se sienten amenazadas.',
              consequence: 'Sin combate. Entran a las ruinas sin ruido.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Las atacan o hacen ruido',
              description: 'Las arañas se sienten acorraladas y atacan.',
              consequence: 'Combate menor. El ruido puede activar tensión en la antecámara.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D6 — Antecámara: investigar el suelo y las runas
    const d6 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Examinan la antecámara derrumbada?',
        context: 'Percepción CD 12. El suelo "late" suavemente. Runas antiguas parcialmente raspadas hacia afuera — como si algo desde dentro empujara.',
        orderIndex: 6,
        status: 'pending',
        positionX: 1200,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Percepción exitosa (CD 12)',
              description: 'El suelo late. Las runas están raspadas desde dentro — algo trata de salir.',
              consequence: 'Comprenden que el sello se está debilitando desde adentro. Ventaja para interpretar las palabras del espíritu.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Fallan o no intentan',
              description: 'Solo sienten un ambiente opresivo sin pistas concretas.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D7 — Cámara de la grieta: reacción al Eco del Espíritu Atado
    const d7 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo reaccionan al Eco del Espíritu Atado en la cámara de la grieta?',
        context: 'Una figura translúcida — hombre alto con armadura erosionada, confundida, no hostil — dice: "¿Quién me despierta? La piedra murmura… Falta un fragmento… El sello se debilita…"',
        orderIndex: 7,
        status: 'pending',
        positionX: 1600,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'Hablan con calma y escuchan',
              description: 'El eco les da la pista clave: el sello original fue hecho con tres reliquias.',
              consequence: 'Información completa sobre el sello. Ruta de reconfortar disponible. Pistas para el Acto 2.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Le colocan el fragmento cerca de la grieta',
              description: 'El espíritu reacciona al fragmento y se estabiliza brevemente.',
              consequence: 'Abre la ruta de reconfortar. El espíritu puede dar más información.',
              outcomeType: 'good',
              orderIndex: 1,
            },
            {
              label: 'Reaccionan con hostilidad o lo ignoran',
              description: 'El eco se desorienta y se distorsiona.',
              consequence: 'Sin información sobre las tres reliquias. Mayor riesgo de activar el evento de corrupción.',
              outcomeType: 'bad',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D8 — ¿Desencadenan el evento de corrupción?
    const d8 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Desencadenan el evento de corrupción en la cámara?',
        context: 'La Sombra de Tierra Corrompida (HP 35, AC 12) se activa si gritan, tiran algo dentro de la grieta, intentan excavar, o pasan más de 15–20 minutos. Ataca primero a quien haya fallado tiradas de miedo previas.',
        orderIndex: 8,
        status: 'pending',
        positionX: 1600,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Gritan, excavan o tiran algo a la grieta',
              description: 'La piedra tiembla. La grieta se ensancha. La Sombra de Tierra Corrompida aparece.',
              consequence: 'Combate con minijefe. La sombra ataca primero a quien haya fallado tiradas previas de miedo.',
              outcomeType: 'bad',
              orderIndex: 0,
            },
            {
              label: 'Tardan más de 15–20 minutos',
              description: 'La corrupción toma fuerza lentamente hasta activar la sombra.',
              consequence: 'Mismo combate pero con menos control de cuándo ocurre.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
            {
              label: 'Se mantienen tranquilos y actúan rápido',
              description: 'No activan la sombra. Pueden resolver sin combate.',
              consequence: 'Ruta de reconfortar o sellar disponible sin combate previo.',
              outcomeType: 'good',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D9 — Resolución final en las ruinas
    const d9 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo resuelven la cámara de la grieta?',
        context: 'La resolución depende de cómo han interactuado con el eco y si activaron la sombra. Perspicacia/Religión CD 12 para reconfortar.',
        orderIndex: 9,
        status: 'pending',
        positionX: 2000,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Reconfortar el Eco (mejor final)',
              description: 'Hablan con calma, prometen investigar o colocan el fragmento. Perspicacia/Religión CD 12. El eco dice: "Detened la grieta. Antes de que la piedra recuerde su nombre…"',
              consequence: 'La grieta deja de expandirse. Harl confía profundamente en ellos. Recompensa: Fragmento Rúnico Sensor.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Sellar por fuerza',
              description: 'Empujan rocas, derriban un tronco o bloquean la grieta con herramientas.',
              consequence: 'La tierra deja de vibrar pero el eco no se calma. Corrupción avanza más despacio. Recompensa: amuleto de madera tallado.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'Huir o ignorar',
              description: 'Se retiran sin resolver el problema.',
              consequence: 'La grieta queda latente y despierta más poder en días siguientes. Signos visibles de corrupción acelerada en el bosque.',
              outcomeType: 'bad',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D10 — Regreso a Harl: ¿son honestos sobre lo encontrado?
    const d10 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Son honestos con Harl al regresar con la información?',
        context: 'Harl escucha con gravedad. Tiene acceso a recursos del poblado y al mapa familiar de pistas. Si descubre una mentira, pierde confianza.',
        orderIndex: 10,
        status: 'pending',
        positionX: 2400,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Cuentan todo honestamente',
              description: 'Harl: "Entonces es cierto… hay algo en la piedra. Algo que quiere salir."',
              consequence: 'Harl entrega el mapa familiar de pistas (ventaja en localizar ruinas relacionadas). Se abre la línea de misiones "Ecos Enanos" en las Montañas Grises.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Mienten u ocultan información',
              description: 'Harl puede descubrir la verdad más adelante.',
              consequence: 'Si lo descubre: pérdida de confianza. Futuras misiones en el valle con menos apoyo.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
            {
              label: 'Cuentan parcialmente (sin el gancho del Acto 2)',
              description: 'Harl queda satisfecho pero sin el contexto completo.',
              consequence: 'Sin penalización inmediata. El mapa se entrega con menos información relevante.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    return { d1, d2, d3, d4, d5, d6, d7, d8, d9, d10 }
  })

  console.log(`\n✓ Seeded 10 decisions for "${mission.name}":`)
  Object.entries(result).forEach(([key, d]) => {
    console.log(`  ${key.toUpperCase()} — ${d.question} (${d.branches.length} branches)`)
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
