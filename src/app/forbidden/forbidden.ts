import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({ imports: [RouterLink], selector: 'app-forbidden', templateUrl: './forbidden.html' })
export class Forbidden {
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly missingScopes = (this.params.get('scopes') ?? '').split(' ').filter(Boolean);
  readonly missingRoles = (this.params.get('roles') ?? '').split(' ').filter(Boolean);
}
