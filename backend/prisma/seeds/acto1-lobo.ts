/**
 * Seed: Acto 1 — El lobo blanco vigila el valle
 *
 * Usage:
 *   CAMPAIGN_NAME="El Último Eco de la Forja" npx ts-node prisma/seeds/acto1-lobo.ts
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
    where: { campaignId: campaign.id, name: { contains: 'lobo blanco' } },
  })
  if (!mission) {
    mission = await prisma.mission.create({
      data: {
        campaignId: campaign.id,
        chapterId: chapter.id,
        name: 'El lobo blanco vigila el valle',
        type: 'secondary',
        status: 'pending',
        orderIndex: 3,
        description:
          'Un enorme lobo blanco ronda el borde del bosque, observando sin atacar. Los orcos lo persiguen como mal presagio. La verdad: es un espíritu antiguo de la tierra despertado por la corrupción de Morladun, buscando a quienes puedan hacerle frente.',
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

    // D1 — Travel event: orcos rastreadores
    const d1 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo reaccionan al grupo de orcos rastreadores?',
        context: 'Evento de viaje (1d20: 11–15). Un grupo de 2–4 orcos en silencio anormal busca al lobo. No quieren pelea.',
        orderIndex: 1,
        status: 'pending',
        positionX: 0,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Se esconden y dejan pasar a los orcos',
              description: 'Los orcos pasan sin detectarlos, murmurando sobre el lobo.',
              consequence: 'Sin combate. Los orcos llegan antes al lobo más tarde en la misión.',
              outcomeType: 'neutral',
              orderIndex: 0,
            },
            {
              label: 'Se enfrentan a los orcos',
              description: 'Combate con orcos básicos (HP 11, AC 13).',
              consequence: 'Los orcos no alertarán al lobo. Puede abrir ventana con el orco dubitativo.',
              outcomeType: 'variable',
              orderIndex: 1,
            },
            {
              label: 'Intentan negociar o distraerlos',
              description: 'Persuasión o Engaño para desviar a los orcos de la ruta del lobo.',
              consequence: 'Si tienen éxito, los orcos se van por otro camino. Si fallan, combate.',
              outcomeType: 'variable',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D2 — El orco dubitativo
    const d2 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Notan y actúan sobre el orco que no quiere matar al lobo?',
        context: 'Perspicacia CD 10 para notar que uno de los orcos camina más lento y no quiere matar al lobo. Si actúan, pueden separarlo o llamar su atención.',
        orderIndex: 2,
        status: 'pending',
        positionX: 400,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'Lo notan y le hablan en susurro o lo separan',
              description: 'El orco se detiene, mira al grupo un segundo, y se va en otra dirección sin pelear.',
              consequence: 'Un orco menos en combate futuro. Posible aliado menor o pista sobre la actitud orco hacia el bosque.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'No lo notan o no actúan',
              description: 'El orco sigue al grupo principal hacia el lobo.',
              consequence: 'Sin cambios. Él será el último en atacar y el primero en huir si se da combate.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D3 — Primer encuentro visual
    const d3 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cómo reaccionan al primer avistamiento del lobo blanco?',
        context: 'El lobo está a 30–60 m, observando en silencio sin sombra propia y sin hacer ruido. Si se acercan a menos de 20 m, retrocede.',
        orderIndex: 3,
        status: 'pending',
        positionX: 400,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Se acercan lentamente, sin amenazar',
              description: 'El lobo retrocede pero no huye. Se mantiene en la distancia.',
              consequence: 'El lobo empieza a evaluar al grupo. Abre la ruta de seguimiento.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Se quedan quietos y lo observan',
              description: 'El lobo los observa en silencio por un momento y luego se aleja hacia el bosque.',
              consequence: 'Relación neutral. Pueden intentar seguirlo.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'Reaccionan de forma amenazante o intentan atacarlo',
              description: 'El lobo se desvanece instantáneamente entre los árboles.',
              consequence: 'El espíritu no regresa. Fin de la misión con consecuencias negativas.',
              outcomeType: 'bad',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D4 — Desafío de rastreo
    const d4 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Logran seguir el rastro del lobo hacia el bosque?',
        context: 'Desafío de grupo CD 13. Habilidades válidas: Supervivencia, Percepción, Arcana/Religión, Sigilo, Naturaleza. Éxito requiere 3/4 aciertos.',
        orderIndex: 4,
        status: 'pending',
        positionX: 800,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Éxito (3+ aciertos)',
              description: 'Descubren el patrón: el lobo rodea una zona específica del bosque como si la vigilara.',
              consequence: 'Llegan al corazón del bosque corrupto siguiendo al lobo. Orcos no llegan primero.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Fracaso (menos de 3 aciertos)',
              description: 'Los orcos llegan primero y espantan al espíritu, obligándolos a seguirlo más adentro del bosque.',
              consequence: 'El trayecto es más peligroso. Los orcos pueden interferir en el encuentro final.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D5 — Investigar las señales de corrupción en el bosque
    const d5 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Investigan las señales de corrupción en el bosque?',
        context: 'Corteza oscurecida, setas negras en grupos perfectos, raíces quemadas por dentro, olor a hierro viejo, grieta oscura en el suelo que parece latir. Investigación CD 12.',
        orderIndex: 5,
        status: 'pending',
        positionX: 1200,
        positionY: -200,
        branches: {
          create: [
            {
              label: 'La examinan y superan la CD 12',
              description: 'Encuentran las tres pistas: raíces quemadas por dentro, olor a hierro viejo, y la grieta oscura que parece latir.',
              consequence: 'Pistas clave sobre el avance de la corrupción de Morladun. Fragmento de corteza ennegrecida disponible.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'La examinan pero fallan la CD',
              description: 'Notan que algo está mal pero no pueden precisar qué.',
              consequence: 'Sin pistas específicas. Sensación de malestar.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'La ignoran y siguen adelante',
              description: 'No obtienen información sobre el avance de la corrupción.',
              consequence: 'Sin pistas. Pierden la oportunidad de encontrar el fragmento de corteza.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D6 — Intentar comunicarse con el espíritu
    const d6 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Intentan comunicarse con el lobo blanco?',
        context: 'El lobo se ha detenido a unos metros, mirándolos casi como invitándolos. Carisma (Persuasión/Empatía) CD 12. No habla, pero proyecta sensaciones.',
        orderIndex: 6,
        status: 'pending',
        positionX: 1200,
        positionY: 200,
        branches: {
          create: [
            {
              label: 'Lo intentan y tienen éxito (CD 12)',
              description: 'El lobo proyecta: tristeza, advertencia, urgencia. Revelación de que es un espíritu antiguo opuesto a Morladun, no su siervo.',
              consequence: 'Comprenden su naturaleza y su misión. Ruta de confianza completamente abierta.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Lo intentan pero fallan la CD',
              description: 'Solo perciben una sensación vaga de que "no es un depredador".',
              consequence: 'Pista parcial. La confianza del espíritu depende de sus acciones futuras.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'No intentan comunicarse',
              description: 'Se limitan a observarlo.',
              consequence: 'Sin revelación de su naturaleza. Solo pueden actuar por intuición.',
              outcomeType: 'neutral',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D7 — Evento clave: defender al espíritu
    const d7 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Defienden al lobo blanco cuando llegan los orcos?',
        context: 'Un grupo de orcos llega gritando "¡Ahí está! ¡Rodeenlo!". El lobo no se defiende — solo retrocede. Los PJ deben decidir.',
        orderIndex: 7,
        status: 'pending',
        positionX: 1600,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Lo defienden y vencen a los orcos',
              description: 'El lobo se acerca a 5 metros, inclina la cabeza en reconocimiento, y luego se desvanece entre los árboles.',
              consequence: 'Espíritu marcará al grupo. Recompensa futura: guía en momento de peligro mortal.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'No intervienen',
              description: 'Los orcos acorralan al lobo. El espíritu se desvanece antes de que lo hieran.',
              consequence: 'El espíritu no confía en el grupo. Sin recompensa futura automática.',
              outcomeType: 'bad',
              orderIndex: 1,
            },
            {
              label: 'Intentan detener a los orcos sin combate',
              description: 'Intimidación o Persuasión para hacer retroceder a los orcos.',
              consequence: 'Si tienen éxito, el lobo los observa con atención antes de desvanecerse. Recompensa futura posible.',
              outcomeType: 'variable',
              orderIndex: 2,
            },
          ],
        },
      },
      include: { branches: true },
    })

    // D8 — Resolución final
    const d8 = await tx.decision.create({
      data: {
        campaignId: campaign.id,
        chapterId:  chapter!.id,
        missionId:  mission!.id,
        missionName: mission!.name,
        question: '¿Cuál es la resolución final con el espíritu del lobo blanco?',
        context: 'La resolución depende del conjunto de acciones tomadas: comunicación, defensa, actitud durante toda la misión.',
        orderIndex: 8,
        status: 'pending',
        positionX: 2000,
        positionY: 0,
        branches: {
          create: [
            {
              label: 'Ganan su confianza (mejor final)',
              description: 'Lo protegieron, no lo hirieron, no intentaron atraparlo. El espíritu los marca.',
              consequence: 'En misión posterior: el Lobo Blanco aparece y los guía fuera de un peligro mortal.',
              outcomeType: 'good',
              orderIndex: 0,
            },
            {
              label: 'Lo siguen sin intervenir',
              description: 'Observaron desde la distancia. El espíritu no confía pero tampoco desconfía.',
              consequence: 'Visión momentánea del bosque corrupto (pistas tempranas). Sin guía futura automática.',
              outcomeType: 'neutral',
              orderIndex: 1,
            },
            {
              label: 'Lo atacan, espantan o permiten su muerte',
              description: 'El lobo se desvanece instantáneamente.',
              consequence: 'La corrupción gana territorio sin vigilante espiritual. Los PJ pierden un aliado clave. Sin recompensa.',
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
