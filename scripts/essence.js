async function OnAddCombatant(combatant, metadata, action, id) {
  const actor = combatant.actor;

  if (!actor) return;

  const isEssenceCaster = await actor.getFlag('pf2e', 'isEssenceCaster') ?? false;

  if (!isEssenceCaster) return;

  const MaxEssence = await actor.getFlag('pf2e', 'maxEssence') ?? 0;

  const DrawEssence = await actor.getFlag('pf2e', 'drawEssence') ?? 0;

  await actor.update({"system.resources.magic.max": MaxEssence});
  await actor.update({"system.resources.magic.value": DrawEssence});

  console.log(`Assigned Essence (${DrawEssence}/${MaxEssence}) to ${actor.name}!`)
}

async function UpdateEssenceOnCast(message, metadata, style, id) {
  if (!metadata) return;

  if (message.isRoll) return;

  if (game.combat == null) return;

  if (message.flags.pf2e.context != null || message.flags.pf2e.context != undefined) {
    if (message.flags.pf2e.context.type == "damage-taken") return;
  }

  if (metadata.flags.pf2e == null || metadata.flags.pf2e == undefined) return;

  const flags = metadata.flags.pf2e;

  if (flags.origin == null || flags.origin == undefined) return;

  const origin = flags.origin;

  if (origin.actor == null || origin.actor == undefined) return;

  const actor = await fromUuid(origin.actor);

  const IsEssenceCaster = await actor.getFlag('pf2e', 'isEssenceCaster') ?? false;

  if (!IsEssenceCaster) return; 
  
  const MaxEssence = await actor.getFlag('pf2e', 'maxEssence') ?? 0;

  const DrawEssence = await actor.getFlag('pf2e', 'drawEssence') ?? 0;

  if (origin.type != "spell") return;

  if(origin.rollOptions.includes("origin:item:trait:focus")) return;

  if (origin.rollOptions.includes("origin:item:trait:cantrip")) {
    let choice = await Dialog.confirm({
        content: `<h2>Do you want to increase your Essence by ${DrawEssence} instead of 1?</h2><br>Click Yes to increase your essence by ${DrawEssence}.<br>Click No to instead only increase your esssence by 1.`
    })
    if (choice) await IncreaseEssence(actor, DrawEssence);
    else await IncreaseEssence(actor, 1);
  } else {
    await IncreaseEssence(actor, 1);
  }
}

async function IncreaseEssence(actor, value) {
  const MaxEssence = await actor.getFlag('pf2e', 'maxEssence') ?? 0;
  const Essence = actor.system.resources.magic.value;

  if (Essence + value > MaxEssence) ResetEssence(actor);
  else {
    await actor.update({"system.resources.magic.value": Essence+value});

    ChatMessage.create( {
      speaker: ChatMessage.getSpeaker(),
      content: `${actor.name}'s Essence increased to ${Essence+value}/${MaxEssence}!`
    })
  }  
}

async function ResetEssence(actor) {
  await actor.update({"system.resources.magic.value": 0});

  ChatMessage.create( {
    speaker: ChatMessage.getSpeaker(),
    content: `${actor.name}'s Essence was reset to 0!`
  })
}

async function ProcessMP(actor, key, level, entry){    
    level = actor.flags?.world?.costOverride ?? level;
    
    let slots = deepClone(entry.system.slots);
    
    slots[key].value = slots[key].max;
    
    await entry.update({"system.slots": slots});
}

Hooks.on('updateItem', (item, data, meta, id) => {
    const IsEssenceCaster = await item.actor.getFlag('pf2e', 'isEssenceCaster') ?? false;

    if (!IsEssenceCaster) return;

    if (item.type != "spellcastingEntry") return;
    
    if (item.isInnate || item.isFocusPool || item.isEphemeral || item.isRitual) return;
    
    if (item.actor.primaryUpdater != game.user) return;
    
    if (!data.system) return;
    
    if (!data.system.slots) return;
    
    for (const [key, slot] of Object.entries(data.system.slots)){
            
            let lvl = parseInt(key.substring(4));
            
            console.log([key,slot,lvl]);
            
            if(lvl <= 0) continue;
      
            if (slot.value != undefined) { 
                let entrySlots = item.system.slots[key];
                
                console.log([entrySlots,key,slot,lvl]);
                
                if (!entrySlots) return;

              if (entrySlots.max != slot.value) ProcessMP(item.actor, key, lvl, item);
            }
        }
});

Hooks.on('preCreateChatMessage', UpdateEssenceOnCast);
Hooks.on('preCreateCombatant', OnAddCombatant);
