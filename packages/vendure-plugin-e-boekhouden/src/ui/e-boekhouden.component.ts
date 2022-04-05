import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { DataService, NotificationService } from "@vendure/admin-ui/core";
import { eBoekhoudenConfigQuery, updateEBoekhoudenConfigMutation } from "./queries.graphql";
import { EBoekhoudenConfig, UpdateEBoekhoudenConfigMutation } from "./generated/graphql";

@Component({
  selector: "e-boekhouden-component",
  template: `
    <form class="form" [formGroup]="form">
      <section class="form-block">
        <vdr-form-field label="Enabled" for="enabled">
          <input
            type="checkbox"
            name="enabled"
            clrCheckbox
            formControlName="enabled"
          />
        </vdr-form-field>
        <vdr-form-field label="apikey" for="apiKey">
          <input id="apiKey" type="text" formControlName="apiKey" />
        </vdr-form-field>
    </form>
  `
})
export class EBoekhoudenComponent implements OnInit {
  form: FormGroup;
  testFailed?: string;
  testResultName?: string;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      enabled: ["enabled"],
      username: ["username"],
      secret1: ["secret1"],
      secret2: ["secret2"],
      contraAccount: ["contraAccount"]
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(eBoekhoudenConfigQuery)
      .mapStream((result: any) => result.eBoekhoudenConfig)
      .subscribe((config) => this.setValues(config));
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        const { updateEBoekhoudenConfig: result } = (await this.dataService
          .mutate(updateEBoekhoudenConfigMutation, {
            input: {
              ...formValue
            }
          })
          .toPromise()) as UpdateEBoekhoudenConfigMutation;
        this.setValues(result);
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success("common.notify-update-success", {
        entity: "Eboekhouden config"
      });
    } catch (e) {
      this.notificationService.error("common.notify-update-error", {
        entity: "Eboekhouden config"
      });
    }
  }

  private setValues(values?: EBoekhoudenConfig | null): void {
    this.form.controls["enabled"].setValue(values?.enabled);
    this.form.controls["username"].setValue(values?.username);
    this.form.controls["secret1"].setValue(values?.secret1);
    this.form.controls["secret2"].setValue(values?.secret2);
    this.form.controls["contraAccount"].setValue(values?.contraAccount);
  }
}
