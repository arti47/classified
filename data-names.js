/* data-names.js — the agent-name tables (house aid).
 *
 * Not from either book. Classified asks for a name and prints none, so a player facing an empty
 * Name field had nothing to roll. These three d100 tables are this app's own, authored for its
 * 1960s-espionage frame: given names and surnames from across the period's intelligence
 * circuit — British, American, French, German, Italian, Spanish, Russian, Scandinavian, Dutch,
 * Greek, Portuguese, Hungarian and more — each one plausible for someone born in the 1920s to
 * the 1940s. A roll is a suggestion: it lands in the editable Name field.
 *
 * Kept out of data.js because data.js is the core book and nothing else, and out of
 * data-solo.js because naming an agent is not a Mythic procedure. The gender split follows the
 * core book's own two columns (the Physical Traits Table), which is why there are two given-name
 * tables and no third.
 */

export const NAME_TABLES_NOTE =
  "The app's own tables, not the book's: a d100 given name by gender and a d100 surname, from across the 1960s espionage circuit.";

export const MALE_NAMES = [
  "Adrian", "Alain", "Albert", "Aleksei", "Alfonso", "Anders", "André", "Anton", "Arthur", "Bernard",
  "Boris", "Bruno", "Carlo", "Charles", "Christophe", "Claude", "Colin", "Conrad", "Daniel", "Desmond",
  "Dieter", "Dimitri", "Edgar", "Edmund", "Emil", "Enrique", "Erik", "Ernst", "Felix", "Fernando",
  "Francis", "Franz", "Frederick", "Gabriel", "Georg", "Gerald", "Giorgio", "Gregor", "Gustav", "Harold",
  "Hans", "Henri", "Hugo", "Ian", "Igor", "Ivan", "Jack", "Jacques", "James", "Jan",
  "Javier", "Johann", "Jonathan", "Jorge", "Julian", "Karl", "Klaus", "Laszlo", "Leon", "Lorenzo",
  "Luca", "Lucien", "Malcolm", "Marcel", "Marco", "Martin", "Matthias", "Maxim", "Michael", "Miguel",
  "Mikhail", "Milos", "Nicholas", "Niels", "Nikolai", "Oliver", "Oskar", "Pablo", "Patrick", "Paul",
  "Pavel", "Peter", "Philippe", "Pierre", "Raymond", "Richard", "Robert", "Roland", "Rupert", "Sergei",
  "Simon", "Stefan", "Stavros", "Thomas", "Tomas", "Victor", "Vincent", "Walter", "Werner", "Yuri"
];

export const FEMALE_NAMES = [
  "Adele", "Agnes", "Alessandra", "Alice", "Anastasia", "Andrea", "Angela", "Anna", "Annika", "Astrid",
  "Beatrice", "Brigitte", "Camille", "Carla", "Caroline", "Catherine", "Cecilia", "Celeste", "Charlotte", "Christina",
  "Claire", "Clara", "Claudia", "Colette", "Daphne", "Diana", "Dominique", "Dora", "Elena", "Eleni",
  "Elisabeth", "Elsa", "Emilia", "Erika", "Esther", "Eva", "Evelyn", "Fiona", "Francesca", "Freya",
  "Gabrielle", "Gina", "Greta", "Hanna", "Helena", "Helga", "Ilona", "Ingrid", "Irena", "Irina",
  "Isabel", "Jacqueline", "Jane", "Joanna", "Josephine", "Julia", "Juliette", "Karin", "Katarina", "Kirsten",
  "Lara", "Laura", "Lena", "Liesel", "Lucia", "Ludmila", "Magda", "Margaret", "Maria", "Marianne",
  "Marina", "Marta", "Mathilde", "Mercedes", "Monica", "Monique", "Nadia", "Natalia", "Nina", "Olga",
  "Paola", "Patricia", "Penelope", "Renata", "Rosa", "Sabine", "Silvia", "Simone", "Sofia", "Solange",
  "Sonja", "Stella", "Svetlana", "Sylvie", "Tatiana", "Teresa", "Ursula", "Valentina", "Vera", "Yvonne"
];

export const SURNAMES = [
  "Adler", "Albrecht", "Alvarez", "Andersson", "Aragon", "Baker", "Barrington", "Bauer", "Becker", "Belmont",
  "Bergman", "Blackwood", "Bonnard", "Brandt", "Carver", "Castellano", "Chevalier", "Conti", "Cordero", "Crane",
  "Dalton", "Delacroix", "De Vries", "Dragomir", "Drummond", "Dubois", "Engel", "Esposito", "Falk", "Fischer",
  "Fontaine", "Fraser", "Gallo", "Garnier", "Gerhardt", "Grant", "Gruber", "Halloran", "Hartmann", "Hayes",
  "Holm", "Ivanov", "Jansen", "Keller", "Kerensky", "Kovacs", "Kowalski", "Laurent", "Lindqvist", "Lombardi",
  "Lund", "Marchetti", "Markovic", "Mercier", "Monroe", "Moreau", "Morozov", "Navarro", "Nilsson", "Novak",
  "Orlov", "Pappas", "Pereira", "Petrov", "Prescott", "Quinn", "Raines", "Reinhardt", "Renard", "Ricci",
  "Rossi", "Rousseau", "Sandoval", "Santoro", "Schmidt", "Sinclair", "Sokolov", "Sorensen", "Stanton", "Sterling",
  "Strand", "Szabo", "Thorne", "Valdez", "Vance", "Varga", "Vasquez", "Vogel", "Volkov", "Wagner",
  "Walsh", "Weiss", "Whitaker", "Winter", "Wolff", "Wyatt", "Young", "Zeller", "Zimmermann", "Zorin"
];

/** The given-name table for a gender: the book's two columns, so two tables. */
export function givenNames(gender) {
  return gender === "female" ? FEMALE_NAMES : gender === "male" ? MALE_NAMES : null;
}
