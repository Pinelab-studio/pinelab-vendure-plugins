---
slug: vendure-common-errors-faq
title: Vendure Common Errors
description: Common Vendure errors and how to fix them. Short, concise entries for issues you might hit when running or extending a Vendure shop.
pubDate: 2026-07-09
author: Martijn
heroImage: https://images.unsplash.com/photo-1516567832553-66232148f74c?q=80&w=2064&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D
heroImageSmall: https://images.unsplash.com/photo-1516567832553-66232148f74c?q=80&w=500&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D
heroImageAlt: Warning sign on a road
---

Common errors and how to fix them. Entries are kept short and concise because many more will be added over time.

## `Enum "Permission" cannot represent value: "MyCustomPermission"`

A custom permission can stay assigned to a role after a plugin is removed. This causes a `Permission` enum error because the value no longer exists. Remove the stale permission from the `role` table:

```sql
UPDATE role
SET permissions = TRIM(BOTH ',' FROM
  REPLACE(
    REPLACE(
      REPLACE(permissions, 'MyCustomPermission,', ''),
      ',MyCustomPermission',
      ''
    ),
    'MyCustomPermission',
    ''
  )
)
WHERE permissions LIKE '%MyCustomPermission%';
```

_More to come!_
