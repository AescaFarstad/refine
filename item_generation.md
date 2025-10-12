item drop rate
raid duration
looting skill
looting difficulty
bags volume

total item value = raid item drop rate * drop raid from focus * raid duration

effective looting skill = max(10, looting skill - looting difficulty)

while (collected item value < total item value)
  let item = generate item
  collected item value += item.value
  if rnd * 100 < effective looting skill
    if item fits in bags
      bags volume -= item.volume
      add item to result
    else
      add to discardedByVolume results
  else
    add to discardedByLuck results

item value = total number of essences * 10

item weights:
common = 200
uncommon = 50 + effective looting skill / 2
rare = 20 + effective looting skill / 5
legendary = effective looting skill / 10

the item is ingererated according to these weights

when the raid completes, this generation happens.
items from the result are added to player's items in game state

Raid outcome contains arrays for looted, discardedByVolume and discardedByLuck items