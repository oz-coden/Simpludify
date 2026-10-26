import { expect, it } from "vitest";
import { Label } from "../../packages/web/src/ui";

it("updates only subscribed text and releases subscriptions", () => {
  const label = Label("one");
  const values: string[] = [];
  const unsubscribe = label.subscribe((value) => values.push(value));
  label.setText("two");
  label.setText("two");
  unsubscribe();
  label.setText("three");
  expect(values).toEqual(["two"]);
  expect(label.text).toBe("three");
});
