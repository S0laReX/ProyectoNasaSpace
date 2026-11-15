// Idiomas de Marswalk. Sin dependencias: diccionarios en JS y una función t(clave, datos).
//   · Un valor puede ser texto, una lista o una función (datos) => texto, para plurales y orden de palabras.
//   · Si falta una clave en un idioma se usa el español, y si tampoco existe, la propia clave.
import es from './es';
import en from './en';
import { POR_DEFECTO } from './config';

export { IDIOMAS, POR_DEFECTO, COOKIE, idiomaDeCabecera } from './config';
export const DICCIONARIOS = { es, en };

const buscar = (dic, clave) => clave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dic);

export function crearT(idioma) {
  const dic = DICCIONARIOS[idioma] ?? DICCIONARIOS[POR_DEFECTO];
  return (clave, datos = {}) => {
    let valor = buscar(dic, clave);
    if (valor === undefined) valor = buscar(DICCIONARIOS[POR_DEFECTO], clave);
    if (valor === undefined) return clave;
    return typeof valor === 'function' ? valor(datos) : valor;
  };
}
