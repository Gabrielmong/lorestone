/**
 * Seed: Acto 1 — El túmulo en la colina oriental
 *
 * Usage:
 *   CAMPAIGN_NAME="El Último Eco de la Forja" npx ts-node prisma/seeds/acto1-tumulo.ts
 *   or set CAMPAIGN_ID directly.
 *
 * Safe to re-run: skips creation if decisions with the same question already exist
 * on the mission.
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
    where: { campaignId: campaign.id, name: { contains: 'túmulo' } },
  })
  if (!mission) {
    mission = await prisma.mission.create({
      data: {
        campaignId: campaign.id,
        chapterId: chapter.id,
        name: 'El túmulo en la colina oriental',
        type: 'secondary',
        status: 'pending',
        orderIndex: 2,
        description:
          'Un cazador desaparecido, una colina que brilla de noche, y un espíritu inquieto atrapado por la corrupción que empieza a filtrar desde la tierra.',
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

    // D1 — Approach
    const d1 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo se acercan al túmulo?',
        context: 'La piedra responde a la luz. La elección de iluminación determina si hay ventana de diálogo con el espíritu.',
        orderIndex: 1,
        status: 'pending',
        positionX: 0,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Antorchas brillantes / luz fuerte',
              description: 'El espíritu aparece directamente corrompido, sin ventana de diálogo.',
              consequence: 'Combate inmediato, sin posibilidad de purificación pacífica.',
              outcomeType: 'bad',
              orderIndex: 0,
            },
            {
              label: 'Una sola vela / linterna atenuada / silencio',
              description: 'El espíritu aparece primero en estado no corrompido.',
              consequence: 'Ventana de diálogo disponible antes de la corrupción.',
              outcomeType: 'good',
              orderIndex: 1,
            },
            {
              label: 'Oscuridad completa',
              description: 'Los susurros del Salón afectan con desventaja, pero el espíritu es más receptivo.',
              consequence: 'Desventaja en salvación de Sabiduría CD 11 en el Salón, pero espíritu más abierto al diálogo.',
              outcomeType: 'variable',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D2 — Wolves (parallel travel event)
    const d2 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo reaccionan a los lobos de la niebla que los acechan?',
        context: 'Evento de viaje (1d20 resultado 11–15). Una pareja de lobos hambrientos observa al grupo.',
        orderIndex: 2,
        status: 'pending',
        positionX: 400,
        positionY: -350,
        branches: {
          create: [
            {
              label: 'Encender antorcha o gritar',
              description: 'Los lobos se retiran sin combate.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Ignorarlos o mostrar miedo',
              description: 'Los lobos atacan.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D3 — Salón de los Susurros
    const d3 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo reducen el efecto de los susurros en el Salón?',
        context: 'Salvación de SAB CD 11. Fallo: estado Asustado 1 minuto. Fuente de luz o calma reducen la dificultad.',
        orderIndex: 3,
        status: 'pending',
        positionX: 400,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Llevan fuente de luz',
              description: 'Ventaja en la tirada de salvación.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Hablan con calma o cantan',
              description: 'La CD baja a 9.',
              outcomeType: 'good',
              orderIndex: 1,
            },
            {
              label: 'No hacen nada especial',
              description: 'CD 11 estándar.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
            {
              label: 'Fallan la salvación',
              description: 'Uno o más personajes quedan Asustados 1 minuto.',
              outcomeType: 'bad',
              orderIndex: 3,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D4 — Talk to spirit
    const d4 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Hablan con el espíritu no corrompido antes de actuar?',
        context: 'Solo disponible si llegaron con luz tenue u oscuridad (D1). El espíritu está confundido, no es violento.',
        orderIndex: 4,
        status: 'pending',
        positionX: 800,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Sí, le hablan con respeto',
              description: 'El espíritu les pide ayuda, les señala la vena oscura, y revela que "una voz fría" lo llama.',
              consequence: 'Pista sobre el origen de la corrupción. Ruta de purificación abierta.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'No / actúan de forma agresiva',
              description: 'La corrupción se activa de inmediato sin más información.',
              consequence: 'Sin pistas, combate directo con el espíritu corrompido.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D5 — Dark vein
    const d5 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Examinan la vena oscura en el suelo de la cámara?',
        context: 'Una vena de piedra oscura se arrastra desde el lado norte del túmulo. El espíritu la señaló si hubo diálogo.',
        orderIndex: 5,
        status: 'pending',
        positionX: 1200,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'La examinan sin tocarla',
              description: 'Pista sobre el origen de la corrupción: viene de fuera, de algo más antiguo que el túmulo.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'La tocan directamente',
              description: 'El personaje recibe 1 punto de Sombra — frío que sube por el brazo.',
              consequence: 'Contaminación menor. No es daño mecánico, pero es rastreable.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
            {
              label: 'La ignoran',
              description: 'Sin consecuencias inmediatas, sin información.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D6 — What triggers corruption
    const d6 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Qué acción desencadena la corrupción en la cámara?',
        context: 'La corrupción se activa si el grupo hace alguna de estas acciones. Mantenerse tranquilos evita el combate.',
        orderIndex: 6,
        status: 'pending',
        positionX: 1200,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Intentan abrir el sarcófago',
              description: 'El espíritu entra en estado corrompido.',
              outcomeType: 'bad',
              orderIndex: 0,
            },
            {
              label: 'Elevan la voz o golpean algo',
              description: 'El espíritu se angustia y arremete involuntariamente.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
            {
              label: 'Tardan más de 20 minutos',
              description: 'La corrupción toma el espíritu lentamente.',
              outcomeType: 'bad',
              orderIndex: 2,
            },
            {
              label: 'Se mantienen tranquilos y respetuosos',
              description: 'La corrupción no se activa. Pueden intentar purificar.',
              consequence: 'Ruta de purificación disponible sin combate previo.',
              outcomeType: 'good',
              orderIndex: 3,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D7 — Spirit retreats
    const d7 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: 'El espíritu intenta retirarse al sarcófago (a 4 PV). ¿Lo dejan o lo bloquean?',
        context: 'El espíritu corrompido a baja salud intenta volver a la tumba. Esto es una ventana para la resolución pacífica.',
        orderIndex: 7,
        status: 'pending',
        positionX: 1600,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Lo dejan retirarse al sarcófago',
              description: 'Abre la posibilidad de purificación o sellado sin destrucción.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Lo bloquean o siguen atacando',
              description: 'El espíritu es destruido por la fuerza.',
              consequence: 'Solo queda el final de abandono/destrucción disponible.',
              outcomeType: 'variable',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D8 — Resolution
    const d8 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo resuelven el espíritu del túmulo?',
        context: 'La resolución final. Las opciones disponibles dependen de cómo llegaron aquí.',
        orderIndex: 8,
        status: 'pending',
        positionX: 2000,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Purificar el espíritu',
              description: 'Palabras tranquilizadoras + mano sobre el sarcófago. Religión / Perspicacia / Actuación CD 12.',
              consequence: 'El espíritu descansa. Recompensa: Talismán del Túmulo (ventaja 1/día en salvaciones contra miedo o corrupción).',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Sellar el túmulo',
              description: 'Bloquear la entrada, colapsar la puerta, o apuntalar el sarcófago.',
              consequence: 'El espíritu no descansa. La corrupción avanza más despacio pero no se detiene. Recompensa menor.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'Abandonar o destruir el espíritu',
              description: 'Huyen o matan al espíritu sin ritual.',
              consequence: 'La corrupción se fortalece en días siguientes. Efectos regionales menores. Sin recompensa.',
              outcomeType: 'bad',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    return { d1, d2, d3, d4, d5, d6, d7, d8 }
  })

  console.log(`\n✓ Seeded 8 decisions for "${mission.name}":`)
  Object.entries(result).forEach(([key, d]) => {
    console.log(`  ${key.toUpperCase()} — ${d.question} (${d.branches.length} branches)`)
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
