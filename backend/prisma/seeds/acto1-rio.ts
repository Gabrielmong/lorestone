/**
 * Seed: Acto 1 — Problemas en el camino del río
 *
 * Usage:
 *   CAMPAIGN_NAME="El Último Eco de la Forja" npx ts-node --transpile-only prisma/seeds/acto1-rio.ts
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

  // ── 2. Find or create chapter ─────────────────────────────────────────────
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

  // ── 3. Find or create mission ─────────────────────────────────────────────
  let mission = await prisma.mission.findFirst({
    where: { campaignId: campaign.id, name: { contains: 'río' } },
  })
  if (!mission) {
    mission = await prisma.mission.create({
      data: {
        campaignId:  campaign.id,
        chapterId:   chapter.id,
        name:        'Problemas en el camino del río',
        type:        'secondary',
        status:      'pending',
        orderIndex:  3,
        description: 'Un comerciante acusa a los Beornings de robo. La verdad está en una cabaña a 45 minutos del vado, donde una madre viuda alimentó a sus hijos con lo único que encontró.',
      },
    })
    console.log(`Created mission: ${mission.name}`)
  } else {
    console.log(`Found mission: ${mission.name}`)
  }

  // ── 4. Guard ──────────────────────────────────────────────────────────────
  const existing = await prisma.decision.count({ where: { missionId: mission.id } })
  if (existing > 0) {
    console.log(`Mission already has ${existing} decision(s) — skipping seed.`)
    return
  }

  // ── 5. Decisions ──────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {

    // D1 — Consult Torgil before leaving
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Buscan a Torgil antes de partir al vado?',
      context:     'El aviso en la pizarra es suficiente para partir. Buscar a Torgil añade contexto y la ficha de madera que actúa como aval.',
      orderIndex:  1,
      status:      'pending',
      positionX:   0,
      positionY:   0,
      branches: { create: [
        {
          label:       'Sí, le preguntan a Torgil',
          description: 'Torgil les da contexto sobre Bregor y los Beornings y les entrega una ficha de madera tallada — su aval personal.',
          consequence: 'Ventaja en la primera tirada social del vado. Apertura inmediata con Bruni y Tava.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'No, parten directamente',
          description: 'Llegan al vado sin contexto previo ni aval.',
          consequence: 'Sin ventajas sociales al llegar. La investigación puede compensarlo.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
      ]},
    }})

    // D2 — Talk to Hildi on the way
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Hablan con Hildi, la mujer Beorning que rema cruzando el río?',
      context:     'Se cruzan con ella en el camino. Sabe cómo está la situación en el vado.',
      orderIndex:  2,
      status:      'pending',
      positionX:   400,
      positionY:   -200,
      branches: { create: [
        {
          label:       'Sí, se detienen a hablar (CD 10 Persuasión)',
          description: 'Hildi les cuenta que Ragnar ya estuvo a punto de tirar a Bregor al agua dos veces y que Bruni lo frenó.',
          consequence: 'Saben de antemano que Ragnar es el punto de tensión. Pueden preparar cómo manejarlo.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'No, siguen camino',
          description: 'Llegan al vado sin saber que Ragnar es la variable impulsiva.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
      ]},
    }})

    // D3 — Managing Ragnar
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Cómo manejan a Ragnar antes de que rompa la negociación?',
      context:     'Ragnar es el reloj de la misión. Si el grupo tarda demasiado en la investigación, vuelve a moverse. Bruni puede frenarlo dos veces, no tres.',
      orderIndex:  3,
      status:      'pending',
      positionX:   400,
      positionY:   200,
      branches: { create: [
        {
          label:       'Le hablan directamente antes de que explote (Persuasión o Intimidación CD 13)',
          description: 'Ragnar se detiene. No se calma del todo, pero respeta que alguien lo trate como parte del asunto.',
          consequence: 'La negociación no tiene reloj. El grupo puede tomarse tiempo con la investigación.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'Lo ignoran y trabajan rápido',
          description: 'Bruni puede frenar a Ragnar dos veces. Si el grupo vuelve con la verdad antes de la tercera, la negociación sigue en pie.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
        {
          label:       'Tardan demasiado — Ragnar explota',
          description: 'Bruni ya no puede frenarlo. La negociación se rompe antes de que el grupo vuelva de los Harthorn.',
          consequence: 'El conflicto escala. Solo quedan opciones de fuerza o mediación de emergencia.',
          outcomeType: 'bad',
          orderIndex:  2,
        },
      ]},
    }})

    // D4 — Investigation at the dock
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Qué líneas de investigación siguen en el vado?',
      context:     'Tres pistas disponibles, cada una apunta a la familia Harthorn. No son excluyentes — el grupo puede seguirlas todas.',
      orderIndex:  4,
      status:      'pending',
      positionX:   800,
      positionY:   0,
      branches: { create: [
        {
          label:       'Examinan el muelle (CD 12 Investigación/Supervivencia)',
          description: 'Huellas pequeñas de niños, tela de Hombres del Bosque, rastro de aceite que va tierra adentro — no al río.',
          consequence: 'Conclusión clara: las cajas no fueron llevadas por agua, sino al bosque.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'Registran la orilla (CD 10 Percepción)',
          description: 'Huellas de carretilla pequeña arrastrada hacia el sendero del bosque, de menos de un día.',
          consequence: 'Dirección confirmada hacia el bosque. Peso consistente con mujer y niños.',
          outcomeType: 'good',
          orderIndex:  1,
        },
        {
          label:       'Hablan con los locales (CD 10–12 Persuasión)',
          description: 'Alguien menciona a los Harthorn: el marido murió en otoño, la madre sola con los niños, cosecha mala.',
          consequence: 'Nombre y destino concreto: la granja Harthorn, 45 minutos por el sendero de abedules.',
          outcomeType: 'good',
          orderIndex:  2,
        },
        {
          label:       'No investigan — van directamente a los Beornings',
          description: 'Sin pruebas. La negociación es un callejón sin salida.',
          consequence: 'Sin información sobre la familia Harthorn. No pueden proponer la Opción 3.',
          outcomeType: 'bad',
          orderIndex:  3,
        },
      ]},
    }})

    // D5 — The old woodcutter
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Hablan con el anciano leñador que observa desde el muelle?',
      context:     'Un leñador veterano está esperando a ver qué hace el grupo antes de hablar. CD 12 Perspicacia para notar que sabe más de lo que dice.',
      orderIndex:  5,
      status:      'pending',
      positionX:   800,
      positionY:   -300,
      branches: { create: [
        {
          label:       'Sí, notan que sabe más y le preguntan (CD 12 Perspicacia)',
          description: 'Confirma los detalles sobre los Harthorn y añade que Tova intentó buscar trabajo en el vado sin éxito.',
          consequence: 'Mejor contexto para el encuentro con Tova. Ventaja en la primera tirada social con ella.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'No lo notan o lo ignoran',
          description: 'El anciano no habla. Se va cuando el grupo sale hacia el bosque.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
      ]},
    }})

    // D6 — Confronting Tova
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Cómo confrontan a Tova en la cabaña de los Harthorn?',
      context:     'Las cajas están abiertas junto al hogar. Tova no miente ni huye. Los niños están presentes.',
      orderIndex:  6,
      status:      'pending',
      positionX:   1200,
      positionY:   0,
      branches: { create: [
        {
          label:       'Con compasión, escuchando antes de acusar',
          description: 'Tova habla con honestidad. Explica que iba a devolver el valor cuando tuviera algo que devolver.',
          consequence: 'Acceso a la información completa. Ruta de negociación abierta.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'De forma acusatoria o directa',
          description: 'Tova se cierra. Responde lo mínimo. Los niños se ponen tensos.',
          consequence: 'Sin contexto adicional. La negociación en el vado tendrá menos fundamentos.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
        {
          label:       'Intentan arrestarla o amenazarla',
          description: 'Tova tira una silla como distracción y corre. Los niños gritan.',
          consequence: 'La misión complica enormemente. La familia desaparece del sector.',
          outcomeType: 'bad',
          orderIndex:  2,
        },
      ]},
    }})

    // D7 — Listen to the river detail
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Escuchan hasta el final lo que dice Tova sobre el río y los peces? (CD 10 Perspicacia)',
      context:     'Tova menciona que el río está raro desde el otoño, que los peces no suben como antes, y que Edric decía que algo en el norte había cambiado. Esto conecta con la influencia de Morladun.',
      orderIndex:  7,
      status:      'pending',
      positionX:   1200,
      positionY:   300,
      branches: { create: [
        {
          label:       'Sí, notan el detalle y preguntan más',
          description: 'Tova: "Yo pensé que era tristeza de viudo. Ahora no sé." — primer indicio ambiental de la corrupción de Morladun afectando el ecosistema.',
          consequence: 'Pista narrativa sobre la escala de la amenaza. Utilizable en conversación con Torgil al regresar.',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'No, siguen con el tema de las cajas',
          description: 'La conversación no va más allá de la situación inmediata.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
      ]},
    }})

    // D8 — Children contradict the story
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    'El hijo mayor (9 años) dice algo que contradice la versión fabricada del grupo. ¿Cómo reaccionan?',
      context:     'Solo ocurre si el grupo estaba preparando una historia falsa. El niño no lo hace por malicia — simplemente no sabe que debería callarse.',
      orderIndex:  8,
      status:      'pending',
      positionX:   1600,
      positionY:   -200,
      branches: { create: [
        {
          label:       'Improvisan para contener el daño (Engaño CD 14)',
          description: 'Intentan tapar la contradicción antes de que Tava la procese.',
          consequence: 'Si fallan, Tava ya sabe que les mienten — no lo dice, pero el trato se complica.',
          outcomeType: 'variable',
          orderIndex:  0,
        },
        {
          label:       'Abandonan la historia falsa y dicen la verdad',
          description: 'Reconocen la contradicción y cambian de enfoque.',
          consequence: 'Tava lo respeta. La negociación gana credibilidad.',
          outcomeType: 'good',
          orderIndex:  1,
        },
        {
          label:       'Intentan callar al niño',
          description: 'Tava lo nota. Bruni lo nota. El ambiente se tensa visiblemente.',
          consequence: 'Desventaja en todas las tiradas sociales siguientes con los Beornings.',
          outcomeType: 'bad',
          orderIndex:  2,
        },
      ]},
    }})

    // D9 — Central choice
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Qué hacen con la verdad al volver al vado?',
      context:     'La elección central de la misión. Define la relación del grupo con los Beornings, los Hombres del Bosque, y las consecuencias futuras.',
      orderIndex:  9,
      status:      'pending',
      positionX:   2000,
      positionY:   0,
      branches: { create: [
        {
          label:       'Exponer a la familia Harthorn',
          description: 'Revelan la verdad completa. Bregor recupera sus cajas. Tova es castigada.',
          consequence: 'Los Hombres del Bosque del sector mantienen distancia. Los Beornings los ven como gente recta. +1 reputación Beornings. 10 po de Bregor.',
          outcomeType: 'neutral',
          orderIndex:  0,
        },
        {
          label:       'Encubrir a la familia con una historia falsa',
          description: 'Mienten o desvían. Tova y sus hijos quedan protegidos. Bregor no recupera nada o recibe una historia inventada.',
          consequence: 'Tova queda en deuda. En el Acto 2 puede tener información sobre orcos. Bregor tiene un agravio latente. +1 reputación Hombres del Bosque.',
          outcomeType: 'variable',
          orderIndex:  1,
        },
        {
          label:       'Negociar un acuerdo justo (mejor desenlace)',
          description: 'Dicen la verdad pero trabajan para una solución que no destruya a la familia. Requiere tres tiradas sociales.',
          consequence: 'Nadie queda con rencor. Tova trabaja una semana en el vado. Ficha de comerciante + cruce gratuito del Anduin para siempre.',
          outcomeType: 'good',
          orderIndex:  2,
        },
      ]},
    }})

    // D10 — Convince Bregor (only if negotiating)
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Convencen a Bregor de aceptar trabajo como pago? (Persuasión CD 13)',
      context:     'Clave: el ángulo correcto es el orgullo — si acepta delante de todos, queda como hombre magnánimo, no como víctima. CD 12 Perspicacia para encontrarlo.',
      orderIndex:  10,
      status:      'pending',
      positionX:   2400,
      positionY:   -200,
      branches: { create: [
        {
          label:       'Éxito — encuentran el ángulo del orgullo (CD 12 Perspicacia + CD 13 Persuasión)',
          description: 'Bregor acepta delante de viajeros y le gusta cómo suena: "¿Una semana de trabajo, dices? ...Supongo que eso vale los tres cajones."',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'Éxito sin el ángulo (CD 13 Persuasión directa)',
          description: 'Bregor acepta, pero de mala gana. No queda satisfecho del todo.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
        {
          label:       'Fallo — Bregor no cede',
          description: 'Insiste en la devolución del valor en moneda. El acuerdo de trabajo no prospera.',
          consequence: 'La Opción 3 falla. Solo quedan exponer o encubrir.',
          outcomeType: 'bad',
          orderIndex:  2,
        },
      ]},
    }})

    // D11 — Convince Bruni and Tava (only if negotiating)
    await tx.decision.create({ data: {
      campaignId:  campaign.id,
      chapterId:   chapter!.id,
      missionId:   mission!.id,
      missionName: mission!.name,
      question:    '¿Convencen a Bruni y Tava de aceptar a Tova trabajando en el vado? (Persuasión CD 11)',
      context:     'Tava evalúa diez segundos. Si percibe que el grupo sabe lo que hace, acepta con respeto directo.',
      orderIndex:  11,
      status:      'pending',
      positionX:   2400,
      positionY:   200,
      branches: { create: [
        {
          label:       'Éxito — Tava acepta con respeto directo',
          description: '"Una semana. Si trabaja bien, el asunto está cerrado." Pausa. "¿Sabe remar?"',
          consequence: 'Acuerdo completo. Bruni: "Volved cuando queráis. El vado está abierto para vosotros."',
          outcomeType: 'good',
          orderIndex:  0,
        },
        {
          label:       'Éxito con fricción — Bruni acepta, Tava observa',
          description: 'Bruni convencido, Tava reservada pero no bloquea.',
          outcomeType: 'neutral',
          orderIndex:  1,
        },
        {
          label:       'Fallo — los Beornings no aceptan',
          description: 'Tava los descarta con cortesía fría. El acuerdo de trabajo no prospera.',
          consequence: 'La Opción 3 falla parcialmente. Bregor queda sin compensación satisfactoria.',
          outcomeType: 'bad',
          orderIndex:  2,
        },
      ]},
    }})

  })

  console.log(`\n✓ Seeded 11 decisions for "${mission.name}"`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
