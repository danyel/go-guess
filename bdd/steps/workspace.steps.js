import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";

async function openLoginPage(world) {
  await world.page.goto(world.baseURL);
  await world.page
    .getByRole("heading", { name: "Sign in to your workspace", exact: true })
    .waitFor();
}

async function signIn(world, email, password) {
  await world.page.getByLabel("Email address", { exact: true }).fill(email);
  await world.page.getByLabel("Password", { exact: true }).fill(password);
  await world.page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
}

Given("the Go Guess application is open", async function () {
  await openLoginPage(this);
});

Given("I am signed in as a valid interviewer", async function () {
  await openLoginPage(this);
  await signIn(this, "integration@example.com", "integration-password");
  await this.page
    .getByRole("heading", {
      name: "Your hiring pipeline, at a glance.",
      exact: true,
    })
    .waitFor();
});

When(
  "I sign in with email {string} and password {string}",
  async function (email, password) {
    await signIn(this, email, password);
  },
);

When("I follow the {string} link", async function (name) {
  await this.page.getByRole("link", { name, exact: true }).first().click();
});

When("I click the {string} button", async function (name) {
  await this.page.getByRole("button", { name, exact: true }).click();
});

When("I select the {string} tab", async function (name) {
  await this.page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
});

When("I fill in the form:", async function (table) {
  for (const [label, value] of table.raw()) {
    await this.page.getByLabel(label, { exact: true }).fill(value);
  }
});

Then("I should see the heading {string}", async function (heading) {
  await this.page
    .getByRole("heading", { name: heading, exact: true })
    .waitFor();
});

Then("I should see {string}", async function (text) {
  await this.page.getByText(text, { exact: true }).first().waitFor();
});

Then("I should see the error {string}", async function (message) {
  await this.page.getByRole("alert").filter({ hasText: message }).waitFor();
});

Then("I should be on the {string} page", async function (path) {
  await this.page.waitForURL((url) => url.pathname === path);
  assert.equal(new URL(this.page.url()).pathname, path);
});

Then(
  "the dashboard should link to jobs, participants, and questions",
  async function () {
    for (const path of ["/jobs", "/participants", "/questions"]) {
      await this.page.locator(`a[href="${path}"]`).first().waitFor();
    }
  },
);

Then("an invitation should be shown for {string}", async function (candidate) {
  await this.page.getByText(candidate, { exact: true }).last().waitFor();
  const invitationURL = await this.page
    .locator(".invitation-row code")
    .textContent();
  assert.match(invitationURL ?? "", /\/participant\/[a-zA-Z0-9_-]+/);
});
