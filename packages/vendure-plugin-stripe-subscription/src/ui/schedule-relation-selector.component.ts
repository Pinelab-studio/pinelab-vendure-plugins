import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RelationCustomFieldConfig } from '@vendure/common/lib/generated-types';
import { DataService, FormInputComponent } from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';
import { StripeSubscriptionSchedule } from './generated/graphql';
import { GET_SCHEDULES } from './queries';

@Component({
  selector: 'schedule-relation-selector',
  template: `
    <div *ngIf="formControl.value as schedule">
      <vdr-chip> 5</vdr-chip>
      {{ schedule.name }}
    </div>
    <select appendTo="body" [formControl]="formControl">
      <option [ngValue]="null">Select a schedule...</option>
      <option *ngFor="let item of schedules$ | async" [ngValue]="item">
        <b>{{ item.name }}</b>
      </option>
    </select>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleRelationSelectorComponent
  implements OnInit, FormInputComponent<RelationCustomFieldConfig>
{
  readonly!: boolean;
  formControl!: FormControl;
  config!: RelationCustomFieldConfig;

  schedules$!: Observable<StripeSubscriptionSchedule[]>;

  constructor(
    private dataService: DataService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    console.log('INITT');
    this.schedules$ = this.dataService
      .query(GET_SCHEDULES)
      .mapSingle((result: any) => result.stripeSubscriptionSchedules ?? []);
  }
}
