Feature: Recruitment workspace
  As an interview team
  We want one connected workspace for jobs, candidates, assessments, and interviews
  So that we can move qualified people through a consistent hiring process

  Scenario: User story - a valid interviewer signs in
    Given the Go Guess application is open
    When I sign in with email "integration@example.com" and password "integration-password"
    Then I should see the heading "Your hiring pipeline, at a glance."
    And I should be on the "/" page

  Scenario: User story - invalid credentials are rejected
    Given the Go Guess application is open
    When I sign in with email "integration@example.com" and password "incorrect-password"
    Then I should see the error "invalid email or password"
    And I should see the heading "Sign in to your workspace"

  Scenario: User story - an interviewer gets a quick pipeline overview
    Given I am signed in as a valid interviewer
    Then I should see the heading "Your hiring pipeline, at a glance."
    And the dashboard should link to jobs, participants, and questions
    And I should see "Integration Backend Engineer"

  Scenario: User story - an interviewer creates a job posting
    Given I am signed in as a valid interviewer
    When I follow the "Jobs" link
    And I follow the "Create job" link
    And I fill in the form:
      | Job title         | BDD Platform Engineer                    |
      | Position          | Platform Engineer                        |
      | Seniority         | Senior                                   |
      | Labels            | Backend                                  |
      | Description       | Build reliable production infrastructure. |
      | Required skills   | Go, PostgreSQL                            |
      | Additional skills | Docker                                   |
    And I click the "Create job" button
    Then I should see the heading "BDD Platform Engineer"
    And I should see "Build reliable production infrastructure."
    And I should see "draft"

  Scenario: User story - an interviewer adds a participant
    Given I am signed in as a valid interviewer
    When I follow the "Participants" link
    And I follow the "Add participant" link
    And I fill in the form:
      | First name          | Beatrice                  |
      | Last name           | Driven                    |
      | Birthday            | 1993-06-14                |
      | Email address       | beatrice.bdd@example.com  |
      | Contact information | Brussels, +32 470 11 22 33 |
    And I click the "Create participant" button
    Then I should see the heading "Beatrice Driven"
    And I should see "beatrice.bdd@example.com"

  Scenario: User story - an interviewer creates a reusable assessment question
    Given I am signed in as a valid interviewer
    When I follow the "Question library" link
    And I fill in the form:
      | Question prompt | How do you keep a deployment reversible? |
      | Reference answer | Use versioned artifacts and tested rollback procedures. |
    And I click the "Create question" button
    Then I should see "How do you keep a deployment reversible?"
    And I should see "Use versioned artifacts and tested rollback procedures."

  Scenario: User story - an interviewer invites a matching candidate
    Given I am signed in as a valid interviewer
    When I follow the "Jobs" link
    And I follow the "Integration Backend Engineer" link
    And I select the "Candidate match" tab
    Then I should see "Integration Candidate"
    And I should see "100%"
    When I select the "Invitations" tab
    And I click the "Generate invitation" button
    Then an invitation should be shown for "Integration Candidate"

  Scenario: User story - an interviewer can reach collaboration areas
    Given I am signed in as a valid interviewer
    When I follow the "Invitations" link
    Then I should see the heading "Invitations"
    And I should see "Invitation zero"
    When I follow the "Schedule" link
    Then I should be on the "/schedule" page
    And I should see "Schedule"
    When I follow the "Users" link
    Then I should see the heading "Interview team"
    And I should see "Integration Interviewer"
