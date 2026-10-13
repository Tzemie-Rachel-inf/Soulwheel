/**
 * Given names, by race. A soul is named when its last wheel lands: a name from its
 * race's pool (or its family's), plus any surname it rolled, plus the best title it
 * earned. Content, not engine: edit freely.
 */

export const NAMES = {
  human: [
    'Aldric', 'Brenna', 'Caius', 'Doran', 'Elowen', 'Fenna', 'Garrick', 'Halvard', 'Isolde', 'Joran',
    'Kestra', 'Lucan', 'Mirela', 'Orin', 'Perrin', 'Rowan', 'Seren', 'Talia', 'Ulric', 'Wren',
  ],
  elf: ['Aelindra', 'Caelith', 'Erevan', 'Faelar', 'Ilyra', 'Lirael', 'Naivara', 'Quelenna', 'Sylvaris', 'Thalion', 'Vaelith', 'Ysolde'],
  dwarf: ['Thorin', 'Brunhild', 'Dagna', 'Durgan', 'Gimra', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Torbera', 'Vondal', 'Eldeth'],
  orc: ['Grukk', 'Mogra', 'Durza', 'Ushnar', 'Krag', 'Shagrol', 'Bolg', 'Yazga', 'Gorbash', 'Murza', 'Thrak', 'Ogdula'],
  halfling: ['Pip', 'Rosie', 'Milo', 'Tansy', 'Bramble', 'Cora', 'Finnick', 'Lavinia', 'Merric', 'Poppy', 'Wendel', 'Hazel'],
  dragonborn: ['Arjhan', 'Balasar', 'Kava', 'Medrash', 'Sora', 'Torinn', 'Vyre', 'Kriv', 'Nala', 'Rhogar'],
  celestial: ['Aurelian', 'Celestine', 'Elyon', 'Seraphine', 'Thaddeus', 'Zuriel', 'Lumen', 'Ariel'],
  goblin: ['Snik', 'Grizzle', 'Nackle', 'Zib', 'Skrag', 'Wort', 'Gibbet', 'Nix', 'Rattle', 'Snotgob'],
  kobold: ['Kib', 'Meepo', 'Ssirik', 'Tazk', 'Vrix', 'Drik', 'Pakk', 'Yip'],
  lizardfolk: ['Sslith', 'Kesh', 'Thrass', 'Ixaxa', 'Grassk', 'Venth'],
  skeleton: ['Rattlebones', 'Clatter', 'Marrow', 'Ossric', 'Hollowjaw', 'Grimsby'],
  lich: ['Vecthar', 'Morvanna', 'Xalzith', 'Ossuar', 'Nethrael', 'Kazimir'],
  ogre: ['Grub', 'Bonk', 'Mungo', 'Hrothgar', 'Gutbelly', 'Brakka'],
  minotaur: ['Asterion', 'Brontes', 'Karos', 'Tauron', 'Merak', 'Hornak'],
  werewolf: ['Fenris', 'Lycaon', 'Garm', 'Ulva', 'Skoll', 'Hati'],
  vampire: ['Valdric', 'Seraphina', 'Mordecai', 'Lucienne', 'Vladislav', 'Isabeau'],
  gnome: ['Fizwick', 'Nim', 'Bimble', 'Orryn', 'Tink', 'Wrenna', 'Dabbin', 'Pockets', 'Zook', 'Ellywick'],
  construct: ['Unit-7', 'Cog', 'Bastion', 'Gearheart', 'Talos', 'Brass', 'Rivet', 'Warden-IX'],
  god: ['Aurion', 'Velara', 'Thaal', 'Nyxara', 'Solenne', 'Kaelos', 'Mirathe', 'Oradun', 'Ysmir', 'Theon'],
  demon: ['Azrakel', 'Belith', 'Malphas', 'Vexis', 'Orobas', 'Zagan', 'Lilitha', 'Furcas', 'Andras', 'Sallos'],
  succubus: ['Lilith', 'Naamah', 'Ishtara', 'Velvetine', 'Morwen', 'Sera'],
  incubus: ['Asmodai', 'Lucan', 'Vashiel', 'Corvin', 'Dorian', 'Xaphan'],
} satisfies Record<string, string[]>;
