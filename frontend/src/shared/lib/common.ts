export const hasOwnProperty = <X extends object, Y extends PropertyKey>(
  obj: X,
  prop: Y
): obj is X & Record<Y, unknown> => Object.prototype.hasOwnProperty.call(obj, prop)

export const isPlainObject = (obj: unknown): obj is Record<string, unknown> =>
  typeof obj === "object" && obj !== null && obj.constructor === Object
