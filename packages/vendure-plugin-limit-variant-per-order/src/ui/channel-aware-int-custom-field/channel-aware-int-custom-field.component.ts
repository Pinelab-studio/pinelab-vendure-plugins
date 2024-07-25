import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  IntCustomFieldConfig,
  SharedModule,
  FormInputComponent,
  Channel,
  DataService,
} from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';
import { GET_ACTIVE_CHANNEL } from './channel-aware-int-custom-field.graphql';
import { ID } from '@vendure/common/lib/shared-types';
import { ActivatedRoute } from '@angular/router';

type ChannelAwareIntValue = {
  channelId: ID;
  value: number;
};
@Component({
  template: `
    <input type="number" min="0" step="1" [formControl]="valueFormControl" />
  `,
  standalone: true,
  imports: [SharedModule],
})
export class ChannelAwareIntCustomFieldComponent
  implements FormInputComponent<IntCustomFieldConfig>, OnInit
{
  isListInput?: boolean | undefined = true;
  readonly!: boolean;
  activeChannel$!: Observable<{
    activeChannel: Pick<Channel, 'id' | 'defaultCurrencyCode'>;
  }>;
  config!: IntCustomFieldConfig;
  formControl!: FormControl<string[]>;
  values!: ChannelAwareIntValue[];
  valueFormControl!: FormControl<number | null>;
  activeChannelId!: ID;
  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(() => {
      setTimeout(() => this.parseFormControlValue(), 10);
    });
  }

  parseFormControlValue() {
    if (this.formControl.value?.length) {
      this.values = this.formControl.value.map(
        (v) => JSON.parse(v) as ChannelAwareIntValue
      );
    } else {
      this.values = [];
    }

    this.activeChannel$ = this.dataService.query<{
      activeChannel: Pick<Channel, 'id' | 'defaultCurrencyCode'>;
    }>(GET_ACTIVE_CHANNEL).stream$;
    this.activeChannel$.subscribe((data) => {
      this.activeChannelId = data.activeChannel.id;
      const channelValue = this.values.find((v) =>
        this.idsAreEqual(v.channelId, this.activeChannelId)
      )?.value;
      this.valueFormControl = new FormControl<number | null>(channelValue ?? 0);
      this.valueFormControl.valueChanges.subscribe((value) => {
        if (!value) {
          //remove entry of this channel
          this.values = this.values.filter(
            (v) => !this.idsAreEqual(v.channelId, this.activeChannelId)
          );
          return;
        }
        const channelData = this.values.find((v) =>
          this.idsAreEqual(v.channelId, this.activeChannelId)
        );
        if (channelData) {
          channelData.value = value;
        } else {
          this.values.push({ channelId: this.activeChannelId, value });
        }
        this.formControl.setValue(this.values.map((v) => JSON.stringify(v)));
        this.formControl.markAsDirty();
      });
      this.cdr.detectChanges();
    });
  }

  idsAreEqual(id1?: ID, id2?: ID): boolean {
    if (id1 === undefined || id2 === undefined || !id2 || !id1) {
      return false;
    }
    return id1.toString() === id2.toString();
  }
}
